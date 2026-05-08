-- Reconstruction Root Categories

-- 🔧 4.1 Recréer ROOT
-- INSERT INTO ps_category
-- (id_category, id_parent, level_depth, active, is_root_category)
-- VALUES (1, 0, 0, 1, 1);
-- 🔧 4.2 Home
INSERT INTO ps_category
(id_category, id_parent, level_depth, active, is_root_category)
VALUES (2, 1, 1, 1, 0);
-- 🔧 4.3 Langue obligatoire
INSERT INTO ps_category_lang
(id_category, id_lang, name, link_rewrite)
VALUES (2, 1, 'Home', 'home');
-- 🔧 4.4 Shop link
INSERT INTO ps_category_shop
(id_category, id_shop)
VALUES (2, 1);