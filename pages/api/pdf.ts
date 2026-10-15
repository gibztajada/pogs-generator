import type { NextApiRequest, NextApiResponse } from 'next';
import { coerceForm } from '@/lib/storage';
import { renderSheetsHtml } from '@/lib/pdf/renderHtml';
import { htmlToPdf } from '@/lib/pdf/browser';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { form, skipped } = coerceForm(req.body);
  if (skipped.length) return res.status(400).json({ error: 'Invalid fields', skipped });
  if (!form.patient.lastName.trim()) return res.status(400).json({ error: 'Patient last name is required' });
  try {
    const pdf = await htmlToPdf(renderSheetsHtml(form));
    const name = `${form.patient.lastName.trim().replace(/[^\w .-]/g, '_')} POGS.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (e) {
    // Never log the request body or patient fields.
    console.error('pdf generation failed:', (e as Error).name);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
}
