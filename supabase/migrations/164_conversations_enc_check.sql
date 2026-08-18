-- Verifier пароля защищённого чата: первый успешный вход записывает
-- зашифрованный токен, дальнейшие входы проверяются по нему.
alter table conversations add column if not exists enc_check text;
