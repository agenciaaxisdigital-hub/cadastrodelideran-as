INSERT INTO public.roles_usuarios (user_id, cargo)
VALUES ('83904b54-579e-4dfe-875f-116057fbb9ae', 'super_admin')
ON CONFLICT (user_id, cargo) DO NOTHING;