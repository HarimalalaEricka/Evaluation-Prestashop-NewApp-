
-- savoir quel taux de TVA s'applique pour la France
SELECT tr.*, t.rate, c.iso_code, cl.name AS country_name
FROM ps_tax_rule tr
JOIN ps_tax t ON tr.id_tax = t.id_tax
LEFT JOIN ps_country c ON tr.id_country = c.id_country
LEFT JOIN ps_country_lang cl ON c.id_country = cl.id_country AND cl.id_lang = 1
WHERE tr.id_country = (SELECT id_country FROM ps_country WHERE iso_code = 'FR');



-- Caracteristique de declinaison
-- ps_attribute_lang -> ny valeur ny declinaison 
-- ps_attribute_group -> 1(select) 2(color)
-- ps_product_attribute -> relit attribut et product
-- ps_product_attribute_combination -> relit attribut et declinaison

SELECT p.`id_product`, p.`reference`, p.`id_shop_default`, ps.`price` AS `price_tax_excluded`, ps.`ecotax` AS `ecotax_tax_excluded`, ps.`id_tax_rules_group`, ps.`active`, pl.`name`, pl.`link_rewrite`, cl.`name` AS `category`, img_shop.`id_image`, img_lang.legend, p.`id_tax_rules_group`, (ps.`price` + ps.`ecotax`) AS `final_price_tax_excluded`, IF(sa.`quantity` IS NULL OR sa.`quantity` = '', 0, sa.`quantity`) AS quantity FROM ps_product p INNER JOIN ps_product_shop ps ON ps.`id_product` = p.`id_product` AND ps.`id_shop` = 1 LEFT JOIN ps_shop s ON s.`id_shop` = ps.`id_shop` LEFT JOIN ps_product_lang pl ON pl.`id_product` = p.`id_product` AND pl.`id_lang` = 1 AND pl.`id_shop` = 1 LEFT JOIN ps_stock_available sa ON sa.`id_product` = p.`id_product`
            AND sa.`id_product_attribute` = 0
         AND sa.`id_shop` = 1 LEFT JOIN ps_category_lang cl ON cl.`id_category` = ps.`id_category_default` AND cl.`id_lang` = 1 AND cl.`id_shop` = 1 LEFT JOIN ps_image_shop img_shop ON img_shop.`id_product` = ps.`id_product` AND img_shop.`cover` = 1 AND img_shop.`id_shop` = 1 LEFT JOIN ps_image_lang img_lang ON img_shop.`id_image` = img_lang.`id_image` AND img_lang.`id_lang` = 1 WHERE p.`state` = 1 ORDER BY id_product desc LIMIT 20
         

SELECT value FROM configuration WHERE name = 'PS_OS_WS_PAYMENT';

UPDATE configuration
SET value = 11 
WHERE name = 'PS_OS_WS_PAYMENT'; 

SELECT 
  pa.id_product_attribute,
  pa.reference,
  pa.price,
  agl.name as groupe,
  al.name as valeur
FROM product_attribute pa
LEFT JOIN product_attribute_combination pac ON pa.id_product_attribute = pac.id_product_attribute
LEFT JOIN attribute a ON pac.id_attribute = a.id_attribute
LEFT JOIN attribute_group ag ON a.id_attribute_group = ag.id_attribute_group
LEFT JOIN attribute_group_lang agl ON ag.id_attribute_group = agl.id_attribute_group AND agl.id_lang = 1
LEFT JOIN attribute_lang al ON a.id_attribute = al.id_attribute AND al.id_lang = 1
WHERE pa.id_product = 1;