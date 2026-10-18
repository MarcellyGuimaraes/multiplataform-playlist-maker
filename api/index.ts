// Única função serverless da API: todas as rotas /api/* chegam aqui pelo rewrite do vercel.json.
import { dispatch } from './_lib/router.js';

export default dispatch;
