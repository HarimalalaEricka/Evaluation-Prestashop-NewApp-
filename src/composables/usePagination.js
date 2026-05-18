import { computed, ref, watch } from 'vue'

export function usePagination(itemsRef, pageSize = 10) {
    const safePageSize = Math.max(1, Number(pageSize) || 10)
    const currentPage = ref(1)

    const totalItems = computed(() => (Array.isArray(itemsRef?.value) ? itemsRef.value.length : 0))
    const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / safePageSize)))

    const paginatedItems = computed(() => {
        const items = Array.isArray(itemsRef?.value) ? itemsRef.value : []
        const startIndex = (currentPage.value - 1) * safePageSize
        return items.slice(startIndex, startIndex + safePageSize).filter(Boolean)
    })

    watch(totalPages, (value) => {
        if (currentPage.value > value) {
            currentPage.value = value
        }

        if (currentPage.value < 1) {
            currentPage.value = 1
        }
    }, { immediate: true })

    function nextPage() {
        if (currentPage.value < totalPages.value) {
            currentPage.value += 1
        }
    }

    function prevPage() {
        if (currentPage.value > 1) {
            currentPage.value -= 1
        }
    }

    function goToPage(page) {
        const nextPageNumber = Number(page)

        if (!Number.isFinite(nextPageNumber)) {
            return
        }

        currentPage.value = Math.min(Math.max(1, nextPageNumber), totalPages.value)
    }

    function resetPage() {
        currentPage.value = 1
    }

    return {
        currentPage,
        paginatedItems,
        totalItems,
        totalPages,
        nextPage,
        prevPage,
        goToPage,
        resetPage,
    }
}