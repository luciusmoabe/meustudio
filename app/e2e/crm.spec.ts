import { test, expect } from '@playwright/test';

test('Criar e visualizar um Lead no CRM', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // 1. Realizar Login
  await page.goto('/login');
  await page.fill('input[type="email"]', 'luciusmoabe@gmail.com');
  await page.fill('input[type="password"]', 'Lmdm@3798');
  await page.click('button[type="submit"]');

  // Aguarda redirecionamento
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

  // 2. Acessar Dashboard de Leads
  await page.goto('/dashboard/leads');
  
  // O sistema pode demorar um pouco para carregar do Supabase
  await expect(page.locator('text=CRM — Leads')).toBeVisible({ timeout: 10000 });
  
  // Aguarda a hidratação do React
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/screenshot-before-click.png', fullPage: true });

  const cookies = await page.context().cookies();
  console.log('BROWSER COOKIES:', cookies.map(c => c.name));
  
  // 3. Clicar em Novo Lead
  await page.dispatchEvent('[data-testid="btn-novo-lead"]', 'click');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/screenshot-after-click.png', fullPage: true });
  await expect(page.locator('[data-testid="modal-title-novo-lead"]')).toBeVisible();

  // 4. Preencher Formulário
  await page.fill('[data-testid="input-nome-cliente"]', 'Lead E2E Teste');
  await page.fill('[data-testid="input-whatsapp-cliente"]', '11912345678');
  await page.fill('[data-testid="input-email-cliente"]', 'teste2@playwright.com');
  
  await page.selectOption('[data-testid="select-tipo-servico"]', { value: 'casamento' });
  
  await page.fill('[data-testid="input-valor-estimado"]', '1200');

  // 5. Salvar
  await page.dispatchEvent('[data-testid="btn-salvar-lead"]', 'click');

  // 6. Verificar se o Lead apareceu no Kanban (no Header ou na primeira coluna)
  await expect(page.locator('text=Lead E2E Teste')).toBeVisible({ timeout: 10000 });
  
  // 7. Verificar se o modal fechou
  await expect(page.locator('h2:has-text("Novo Lead")')).not.toBeVisible();
});

