import { test, expect } from '@playwright/test';

test.describe('Cobrança de Fotos Extras Dinâmica', () => {
  const token = 'af6e126d0d12f3a0b75fc787b75ce20bf4fb4eceb5aaddb3b9153ae551a0b400';

  test('Cliente excede o limite, vê o banner e faz checkout', async ({ page }) => {
    // Aumenta o timeout padrão devido a animações
    test.setTimeout(60000);

    await page.goto(`http://localhost:3000/cliente/${token}`);

    // Aguarda carregar o portal (botão da galeria)
    await page.waitForSelector('button:has-text("Galeria")', { timeout: 15000 });

    // Navega para aba Galeria
    await page.click('button:has-text("Galeria")');
    
    // Aguarda as fotos aparecerem (tem que ter pelo menos 3 imagens)
    const botoesFavorito = page.locator('button:has(.lucide-heart)');
    await botoesFavorito.nth(2).waitFor({ state: 'visible', timeout: 15000 });

    // Seleciona as 3 fotos clicando nelas (clicar na própria imagem seleciona)
    const imagens = page.locator('img[alt^="Foto"]');
    await imagens.nth(0).click();
    await imagens.nth(1).click();
    await imagens.nth(2).click();

    await expect(page.locator('text=Você selecionou 1 foto(s) extras')).toBeVisible();
    await expect(page.locator('text=Pagar Fotos Extras (R$ 25,00)')).toBeVisible();

    // Clica para abrir o checkout de extras
    await page.click('button:has-text("Pagar Fotos Extras")');

    // Verifica se o checkout abriu
    await expect(page.locator('text=Pagamento de Fotos Extras')).toBeVisible();
    await expect(page.locator('text=Total a pagar: R$ 25,00')).toBeVisible();

    // Seleciona Pix
    await page.locator('label:has-text("Pix")').click();

    // Intercepta a requisição da API de pagamentos para não gerar lixo real se não precisar
    await page.route('/api/pagamentos', async route => {
      const json = {
        pagamento: {
          id: 'mock-123',
          tipo_cobranca: 'complemento',
          meio_pagamento: 'pix',
          pix_copia_cola: '00020126580014br.gov.bcb.pix0136test5204000053039865802BR5925Test6009SAO PAULO62070503***6304ABCD',
          pix_qrcode_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=test'
        }
      };
      await route.fulfill({ json, status: 201 });
    });

    // Clica em Pagar e Concluir
    await page.click('button:has-text("Pagar R$ 25,00 e Concluir")');

    // Deve redirecionar para a aba de pagamento ou mostrar o QR Code
    // Aguarda o QR code aparecer
    await expect(page.locator('text=Pague com Pix')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=000201265800')).toBeVisible();
  });
});
