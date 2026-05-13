import express from 'express'
import axios from 'axios'
import bcrypt from 'bcrypt'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const BASE_URL = 'http://localhost/prestashop/api'
const API_KEY = 'eTPIXHBYTnX9cmqkoZe0DmL0zOsBZA9D'

// 🔎 récupérer customer par email
async function getCustomerByEmail(email, id) {
    const url = `${BASE_URL}/customers/[${id}]?filter[email]=[${email}]&output_format=JSON`

    const res = await axios.get(url, {
        auth: {
            username: API_KEY,
            password: ''
        }
    })

    return res.data.customers?.[0]
}

// 🔐 login
app.post('/login', async (req, res) => {
    try {
        const { email, password, id } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing fields' })
        }

        // 1. chercher user
        const customer = await getCustomerByEmail(email, id)

        if (!customer) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // 2. récupérer détails complets (avec passwd)
        const detailRes = await axios.get(
            `${BASE_URL}/customers/${customer.id}?output_format=JSON`,
            {
                auth: {
                    username: API_KEY,
                    password: ''
                }
            }
        )

        const user = detailRes.data.customer

        // 3. vérifier password bcrypt
        const isValid = await bcrypt.compare(password, user.passwd)

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // 4. retour safe
        res.json({
            id: user.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname
        })

    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

app.listen(3000, () => {
    console.log('🚀 Auth server running on http://localhost:3000')
})