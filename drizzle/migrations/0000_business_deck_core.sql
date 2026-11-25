CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'user');
CREATE TYPE public.card_status AS ENUM ('draft', 'pending', 'active', 'archived', 'rejected');
CREATE TYPE public.card_mode AS ENUM ('online', 'city');

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  subniche text NOT NULL,
  UNIQUE (niche, subniche)
);
GRANT SELECT ON public.topics TO anon, authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics readable" ON public.topics FOR SELECT USING (true);

CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'Германия'
);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cities readable" ON public.cities FOR SELECT USING (true);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  telegram text,
  website text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status public.card_status NOT NULL DEFAULT 'draft',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  photo_url text,
  topic_id uuid REFERENCES public.topics(id),
  subtopic text,
  mode public.card_mode NOT NULL DEFAULT 'online',
  city_id uuid REFERENCES public.cities(id),
  headline text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 60),
  advice_title text NOT NULL DEFAULT '',
  advice_text text NOT NULL DEFAULT '' CHECK (char_length(advice_text) <= 280),
  cta text NOT NULL DEFAULT '' CHECK (char_length(cta) <= 80),
  telegram text,
  qr_target_url text,
  slug text UNIQUE,
  deck_issue int,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cards_one_expert_per_topic
  ON public.cards (topic_id, mode, COALESCE(city_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('active', 'pending');
GRANT SELECT ON public.cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active cards public" ON public.cards FOR SELECT USING (status = 'active');
CREATE POLICY "own cards read" ON public.cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin cards read" ON public.cards FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own cards insert" ON public.cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status IN ('draft', 'pending'));
CREATE POLICY "own cards update" ON public.cards FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin cards update" ON public.cards FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own cards delete" ON public.cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cards_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status <> 'active')
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only moderators can activate cards';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'active'
     AND NOT public.has_role(auth.uid(), 'admin')
     AND (NEW.topic_id IS DISTINCT FROM OLD.topic_id OR NEW.mode IS DISTINCT FROM OLD.mode OR NEW.city_id IS DISTINCT FROM OLD.city_id) THEN
    RAISE EXCEPTION 'Active card topic cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cards_guard BEFORE INSERT OR UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.cards_guard();

-- Who occupies a topic (active or under review). Exposes only the first name + last initial.
CREATE OR REPLACE FUNCTION public.topic_occupant(_topic uuid, _mode public.card_mode, _city uuid, _exclude uuid DEFAULT NULL)
RETURNS TABLE (holder text, status public.card_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trim(first_name || ' ' || left(last_name, 1) || CASE WHEN last_name <> '' THEN '.' ELSE '' END), status
  FROM public.cards
  WHERE topic_id = _topic AND mode = _mode
    AND COALESCE(city_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(_city, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status IN ('active', 'pending')
    AND (_exclude IS NULL OR id <> _exclude)
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.topic_occupant TO anon, authenticated;

-- All busy topic keys, for showing free alternatives.
CREATE OR REPLACE FUNCTION public.busy_topics()
RETURNS TABLE (topic_id uuid, mode public.card_mode, city_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT topic_id, mode, city_id FROM public.cards WHERE status IN ('active', 'pending') AND topic_id IS NOT NULL
$$;
GRANT EXECUTE ON FUNCTION public.busy_topics TO anon, authenticated;

INSERT INTO public.cities (name) VALUES ('Берлин'), ('Мюнхен'), ('Гамбург'), ('Франкфурт'), ('Кёльн');

INSERT INTO public.topics (niche, subniche) VALUES
('Маркетинг','SMM'),('Маркетинг','Performance'),('Маркетинг','Контент-маркетинг'),('Маркетинг','Брендинг'),
('Юристы','Трудовое право'),('Юристы','Миграционное право'),('Юристы','Корпоративное право'),('Юристы','Налоговое право'),
('Психология','Коучинг'),('Психология','Семейная терапия'),('Психология','Бизнес-психология'),
('Производство','Мебель'),('Производство','Пищевое производство'),('Производство','Текстиль'),
('IT','Аутсорс'),('IT','Веб-разработка'),('IT','Мобильные приложения'),('IT','Автоматизация и боты'),
('Финансы','Бухгалтерия'),('Финансы','Инвестиции'),('Финансы','Страхование'),
('Недвижимость','Аренда'),('Недвижимость','Покупка и продажа'),
('HR','Подбор персонала'),('HR','Обучение команд'),
('Дизайн','Интерьер'),('Дизайн','Графический дизайн'),
('Образование','Языковые курсы'),('Образование','Детские программы'),
('Красота и здоровье','Косметология'),('Красота и здоровье','Фитнес'),
('Ивенты','Организация мероприятий'),('Фото и видео','Фотосъёмка'),('Фото и видео','Видеопродакшн'),
('Логистика','Переезды и доставка'),('Еда','Кейтеринг');