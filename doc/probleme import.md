f1
avalaible_date

f2
le stock tsy updater tsony
prix_ttc
nom par defaut select
prix_ht mipotra ary am fo nefa tokony le ttc -> misy tsy tafiditra zany ao 

f3
etat de commande 
mouvement de stock
money payer
prix_ttc anle produit mipotra am commande -> any am panier koa hafahafa


fonctionnalite
page import
page reset
liste produit efa ttc ny mipotra ao fa le default an ny declinaison mbola
id_product_attribute sy id_delivery sy id_customer ao anaty panier
mi ajouter dans le panier 
quantite anle produit no ovaina anaty panier
let ht = parseFloat(produit.price) * product.quantity // ht 
let ttc = ht; // ttc -> a implementer ni resaka tax fa mbola tsy ao ( innsertCommande)
resaka prix par declinaison koa mbola tsy ao amle insertCommande
refa manao insert commande de lasa 11 fona ny state nefa 2 ny default
etat de mes commandes
group + valeur dans stocks
resaka guest




Oui — via le webservice PrestaShop vous pouvez trier par date avec le paramètre sort. Exemple (ordre décroissant par date de création date_add):

GET:
/api/orders?display=full&sort=[date_add_DESC]

cURL:
curl -u YOUR_KEY: 'http://your-shop.example/api/orders?display=full&sort=[date_add_DESC]'

Pour tri croissant utilisez sort=[date_add_ASC]. Vous pouvez aussi combiner limit et filter[...] si besoin (par ex. &limit=0,20 ou &filter[id_customer]=[12]).