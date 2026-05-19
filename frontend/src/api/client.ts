import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 120_000, // 2 min for large batch uploads
})

export default client
