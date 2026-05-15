Bouton ajouter au panier
    Pas de panier existant (cart id absent)
        → INSERT dans ps_cart (création du panier via Cart::add()).
        Exemple : INSERT INTO ps_cart (...) VALUES (...).

    Panier existant
        → UPDATE de ps_cart (mise à jour date_upd) via Cart::update().
        Exemple : UPDATE ps_cart SET date_upd = ... WHERE id_cart = X.

    Quantité demandée <= 0
        → Suppression du produit via Cart::deleteProduct() : DELETE FROM ps_cart_product WHERE id_cart=... AND id_product=... [et conditions optionnelles id_product_attribute, id_customization, id_address_delivery].
        → Si customizations associées : DELETE FROM ps_customized_data et DELETE FROM ps_customization.

    Le produit est déjà présent dans le panier (getProductQuantity > 0) et on ajoute (op='up') ou retire (op='down') une quantité
        → UPDATE sur ps_cart_product :
        UPDATE ps_cart_product SET quantity = quantity + N (ou

    POST /api/cart avec xml complet
    id_customer
    required 
        default
            id_lang
            id_currency
        id_product
        id_product_attribute
        id_adress_delivery
        quantity
        
   
bouton commander
    ps_orders
    ps_order_detail (+ ps_order_detail_tax)
    ps_order_history
    ps_order_payment (et parfois ps_order_invoice_payment)
    ps_order_carrier
    ps_order_cart_rule (si remises)
    tables de stock (selon config stock/état commande)
    Mais ce n’est pas “100% garanti dans tous les cas” :

    si module paiement invalide/inactif
    si id_cart incohérent ou déjà commandé
    si montants incohérents (peut passer en état erreur)
    selon configuration boutique (facture, stock avancé, statuts)

    required
        id_adress_delivery
        id_adress_invoce
        id_cart
        id_currency
        id_lang
        id_customer
        id_carrier
        current_state
        module
        payement
        total_paid
        total_products
        total_products_wt
        conversion_rate
        product_id
        product_attribute_id
        product_quantity
