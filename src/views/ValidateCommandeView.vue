<script setup(props) {}>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { checkQuantity } from '../services/commandeService.js'

const route = useRoute()
const stocks = ref([])

async function fetchStockDispoByCommandeId( id_commande, quantity)
{
    try{
        const id_commande = route.params.id
        const quantity = route.params.quantity
        stocks.value = await checkQuantity(id_commande, quantity)
        console.log(stocks)
    }
    catch(error) {

    }
}

onMounted(() => {
    fetchStockDispoByCommandeId(id_commande, quantity)
})
</script>
<template>
    <div>
        
    </div>
</template>