<script>
const idCustomer = getCustomerId()

function getCustomerId() {
  const customerConnected = localStorage.getItem('customerConnected')

  if (!customerConnected) return 0

  try {
    const customer = JSON.parse(customerConnected)
    return Number(customer?.id ?? 0)
  } catch (error) {
    console.error('Impossible de lire customerConnected:', error)
    return 0
  }
}
</script>
<template>
    <div>
        <h1>{{ idCustomer }}</h1>
    </div>
</template>