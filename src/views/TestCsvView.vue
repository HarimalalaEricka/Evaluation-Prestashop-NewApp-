<script>
import Papa from 'papaparse';

export default {
    data() {
        return {
            file: null,
            content: {
                data: [],
                meta: {
                    fields: []
                }
            },
            parsed: false
        }
    },

    methods: {
        handleFileUpload(event) {
            this.file = event.target.files[0];
            this.parseFile();
        },

        parseFile() {
            if (!this.file) return;

            Papa.parse(this.file, {
                header: true,
                skipEmptyLines: true,

                complete: (results) => {
                    this.content = results;
                    this.parsed = true;

                    console.log(results);
                },

                error: (error) => {
                    console.error(error);
                }
            });
        }
    }
}
</script>

<template>
    <input
        type="file"
        accept=".csv"
        @change="handleFileUpload"
    />

    <button @click="parseFile">
        Parse
    </button>

    <table v-if="parsed" style="width: 100%;">
        <thead>
            <tr>
                <th
                    v-for="(header, key) in content.meta.fields"
                    :key="'header-' + key"
                >
                    {{ header }}
                </th>
            </tr>
        </thead>

        <tbody>
            <tr
                v-for="(row, rowKey) in content.data"
                :key="'row-' + rowKey"
            >
                <td
                    v-for="(column, columnKey) in content.meta.fields"
                    :key="'row-' + rowKey + '-column-' + columnKey"
                >
                    <input
                        v-model="content.data[rowKey][column]"
                    />
                </td>
            </tr>
        </tbody>
    </table>
</template>

<style scoped>
table {
    border-collapse: collapse;
}

th,
td {
    border: 1px solid #ccc;
    padding: 5px;
}
</style>