<script setup>
import { computed, ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { buildProductImageUrl, getRessourceItemById } from "../services/ressourcesService.js";
import { addCart, updateCart, getCartByCustomerId, getCartByGuestId } from "../services/CartService.js";
import {
  getQuantityAvailableByProductId,
  getQuantityAvailableByProductIdAndAttribute,
  getRateByTaxRulesGroupId,
  getMarqueByProductId,
} from "../services/productService.js";

const route = useRoute();
const router = useRouter();
const product = ref(null);
const loading = ref(false);
const error = ref("");
const quantity = ref(1);
const carts = ref([]);
const quantityAvailable = ref(0);
const tax_rate = ref(0);
const marque = ref("");
const quantityAvailableAttribute = ref([]);
const selectedQuantityAttribute = ref(null);
const priceFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const priceWithSelectedAttribute = computed(() => {
  const basePrice = Number(product.value?.price ?? 0);
  const attributePrice = Number(selectedQuantityAttribute.value?.price ?? 0);
  return (basePrice + attributePrice) * (1 + tax_rate.value / 100);
});

const formattedPriceWithSelectedAttribute = computed(() =>
  priceFormatter.format(priceWithSelectedAttribute.value)
);

const isCombinationProduct = computed(() => product.value?.product_type === "combinations");
const selectedProductAttributeId = computed(() =>
  Number(selectedQuantityAttribute.value?.id_product_attribute ?? 0)
);
const productImageUrl = computed(() => buildProductImageUrl(product.value));

function getActiveSessionInfo() {
  try {
    const rawCustomer =
      localStorage.getItem("guest") ||
      localStorage.getItem("guestSession") ||
      localStorage.getItem("customerConnected") ||
      localStorage.getItem("customerCartUser") ||
      localStorage.getItem("customer");

    if (!rawCustomer) {
      return { type: null, id: null };
    }

    const customer = JSON.parse(rawCustomer);
    const sessionType = String(customer?.sessionType ?? '').toLowerCase();
    const isGuest = sessionType === 'guest' || Boolean(customer?.guestId ?? customer?.id_guest);
    const sessionId = isGuest
      ? Number(customer?.guestId ?? customer?.id ?? customer?.id_guest ?? null)
      : Number(customer?.id ?? customer?.id_customer ?? customer?.customerId ?? null);
    const customerId = Number(
      sessionId
    );

    if (Number.isNaN(customerId)) {
      return { type: null, id: null };
    }

    console.log('[ProductDetailView] session active =', isGuest ? 'guest' : 'customer', {
      id: customerId,
      source: isGuest ? 'guest' : 'customerConnected',
    });

    return {
      type: isGuest ? "guest" : "customer",
      id: customerId,
    };
  } catch (error) {
    console.warn("[ProductDetailView] impossible de lire le client connecté", error);
    return { type: null, id: null };
  }
}

function extractCreatedCartId(response) {
  if (!response) {
    return null;
  }

  if (typeof response === "object" && response.id != null) {
    const numericId = Number(response.id);
    return Number.isNaN(numericId) ? null : numericId;
  }

  const responseText = String(response);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(responseText, "application/xml");
  const idNode = xmlDoc.getElementsByTagName("id")[0];
  const numericId = Number(idNode?.textContent ?? "");

  return Number.isNaN(numericId) ? null : numericId;
}
async function fetchProduct() {
  const productId = route.params.id;

  if (!productId) {
    error.value = "Identifiant produit manquant";
    return;
  }

  loading.value = true;
  error.value = "";

  const activeSession = getActiveSessionInfo();

  console.log("[ProductDetailView:fetchProduct] active session", activeSession);

  if (!activeSession.id) {
    error.value = "Aucun client/guest connecté trouvé";
    loading.value = false;
    return;
  }

  try {
    product.value = await getRessourceItemById("products", productId);
    marque.value = await getMarqueByProductId(productId, product.value?.available_date);
    carts.value = activeSession.type === "guest"
      ? await getCartByGuestId(activeSession.id)
      : await getCartByCustomerId(activeSession.id);
    quantityAvailable.value = await getQuantityAvailableByProductId(productId);
    tax_rate.value = await getRateByTaxRulesGroupId(product.value.id_tax_rules_group);
    quantityAvailableAttribute.value = await getQuantityAvailableByProductIdAndAttribute(productId);
    console.log('QUANTITY',quantityAvailableAttribute.value);
    selectedQuantityAttribute.value = quantityAvailableAttribute.value[0] ?? null;

    if (carts.value && carts.value.id) {
      localStorage.setItem("customerCart", String(carts.value.id));
    } else {
      localStorage.removeItem("customerCart");
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

function backToProducts() {
  router.push({ name: "products" });
}
async function ajouterPanier() {
  if (!product.value) {
    alert("Produit non chargé");
    return;
  }

  const activeSession = getActiveSessionInfo();
  if (!activeSession.id) {
    alert("Aucun client/guest connecté trouvé");
    return;
  }

  try {
    const quantityToAdd = Math.max(1, Math.trunc(Number(quantity.value) || 1));
    const cartUser = localStorage.getItem("customerCart");
    const cartId = Number(cartUser);
    const isGuest = activeSession.type === "guest";

    console.log('[ProductDetailView:ajouterPanier] cart state', {
      cartUser,
      cartId,
      selectedAttribute: selectedQuantityAttribute.value,
      quantityToAdd,
      id_product_attribute: selectedProductAttributeId.value
    });

    if (isCombinationProduct.value && !selectedQuantityAttribute.value) {
      alert("Sélectionnez un attribut avant d'ajouter ce produit au panier");
      return;
    }

    if (!cartUser || Number.isNaN(cartId) || cartId <= 0) {
      const createdCart = await addCart(
        product.value.id,
        quantityToAdd,
        activeSession.id,
        selectedProductAttributeId.value,
        isGuest
      );
      const createdCartId = extractCreatedCartId(createdCart);

      console.log('[ProductDetailView:ajouterPanier] cart created', {
        createdCart,
        createdCartId,
      });

      if (createdCartId) {
        localStorage.setItem("customerCart", String(createdCartId));
      } else {
        localStorage.removeItem("customerCart");
      }
    } else {
      console.log('[ProductDetailView:ajouterPanier] updating existing cart', cartId);
      await updateCart(cartId, product.value.id, quantityToAdd, selectedProductAttributeId.value);
    }
    alert("Produit ajouté au panier");
  } catch (err) {
    console.error(
      "Erreur lors de l'ajout au panier : " +
        (err instanceof Error ? err.message : String(err))
    );
  }
}
onMounted(() => {
  fetchProduct();
});
</script>

<template>
  <div>
    <h1>Fiche produit</h1>

    <button @click="backToProducts">Retour à la liste</button>

    <p v-if="loading">Chargement...</p>
    <p v-else-if="error">{{ error }}</p>

    <div v-else-if="product">
      <div v-if="productImageUrl" style="margin-bottom: 16px;">
        <img
          :src="productImageUrl"
          :alt="product?.name?.language || product?.name || 'Produit'"
          width="220"
          height="220"
          style="object-fit: cover; border-radius: 12px; display: block;"
        />
      </div>
        <p><strong>ID :</strong> {{ product.id }}</p>
        <p><strong>Référence :</strong> {{ product.reference }}</p>
        <p><strong>Nom :</strong> {{ product.name?.language || product.name }}</p>
        <p>
            <strong>Description :</strong>
            <span
            v-html="product.description_short?.language || product.description_short"
            ></span>
        </p>
        <p><strong>Prix :</strong> {{ formattedPriceWithSelectedAttribute }} €</p>
        <p><strong>Marque :</strong> {{ marque || "-" }}</p>
        <p><strong>État :</strong> {{ product.active }}</p>
        <p v-if="isCombinationProduct">
          <strong>Attribut :</strong>
          <select v-model="selectedQuantityAttribute">
                <option value="null" disabled>Sélectionnez un attribut</option>
                <option 
                    v-for="quantity in quantityAvailableAttribute" 
                    :key="quantity.value"
              :value="quantity"
                >{{ quantity.group }} - {{ quantity.value}} </option>
            </select>
        </p>
        <p v-else>
          <strong>Type :</strong> Produit standard (pas de variation)
        </p>
        <p><strong>Quantité disponible :</strong> {{ quantityAvailable }}</p>
        <label for="quantity">Quantité :</label>
        <input type="number" id="quantity" v-model.number="quantity" min="1" step="1" />
        <button @click="ajouterPanier">Ajouter au panier</button>
    </div>
    <div>
      <table border="1" v-if="isCombinationProduct">
        <thead>
          <tr>
            <th>Stock ID</th>
            <th>Groupe</th>
            <th>Valeur</th>
            <th>Stock disponible</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="quantity in quantityAvailableAttribute" :key="quantity.id">
            <td>{{ quantity.id }}</td>
            <td>{{ quantity.group }}</td>
            <td>{{ quantity.value }}</td>
            <td>{{ quantity.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
