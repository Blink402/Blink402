import { test, expect } from '@playwright/test'

// Test: Easy Mode and Advanced Mode options on create page
test('should display Easy Mode and Advanced Mode options on create page', async ({ page }) => {
  await page.goto('/create')

  // Check that both mode options are visible
  await expect(page.getByText('Easy Mode')).toBeVisible()
  await expect(page.getByText('Advanced Mode')).toBeVisible()

  // Check for the "Recommended" badge on Easy Mode
  await expect(page.getByText('Recommended')).toBeVisible()
})

// Test: Navigate to template gallery
test('should navigate to template gallery when clicking Easy Mode', async ({ page }) => {
  await page.goto('/create')

  // Click on Easy Mode link
  await page.getByRole('link', { name: /Easy Mode/i }).click()

  // Wait for navigation to complete
  await page.waitForURL('**/create/easy')

  // Check that we're on the template gallery page
  await expect(page.getByText('Easy Mode: Pick a Template')).toBeVisible()
})

// Test: Template gallery displays templates
test('should display template cards in gallery', async ({ page }) => {
  await page.goto('/create/easy')

  // Check page title
  await expect(page.getByText('Easy Mode: Pick a Template')).toBeVisible()

  // Check for description
  await expect(page.getByText(/No coding required/i)).toBeVisible()

  // Wait for templates to load
  await page.waitForTimeout(1000)

  // Check that templates are displayed
  await expect(page.getByRole('heading', { name: 'QR Code Generator' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Random Dad Joke' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Crypto Price Checker' }).first()).toBeVisible()
})

// Test: Search functionality
test('should filter templates by search query', async ({ page }) => {
  await page.goto('/create/easy')

  // Wait for page to load
  await page.waitForTimeout(1000)

  // Type in search box
  const searchBox = page.getByPlaceholder(/Search templates/i)
  await searchBox.fill('joke')

  // Wait for filter to apply
  await page.waitForTimeout(500)

  // Check that only joke-related templates are shown
  await expect(page.getByRole('heading', { name: 'Random Dad Joke' })).toBeVisible()
})

// Test: Category filtering
test('should filter templates by category', async ({ page }) => {
  await page.goto('/create/easy')

  // Wait for page to load
  await page.waitForTimeout(1000)

  // Click on "fun" category
  await page.getByRole('button', { name: /fun/i }).click()

  // Wait a bit for filter to apply
  await page.waitForTimeout(500)

  // Should show fun templates
  await expect(page.getByRole('heading', { name: 'Random Dad Joke' })).toBeVisible()
})

// Test: Navigate to template builder
test('should navigate to template builder when clicking a template', async ({ page }) => {
  await page.goto('/create/easy')

  // Wait for page to load
  await page.waitForTimeout(1000)

  // Click on QR Code template
  await page.getByText('QR Code Generator').first().click()

  // Wait for navigation
  await page.waitForURL('**/create/easy/qr-code-generator')

  // Check that we're on the builder page
  await expect(page.getByText('QR Code Generator')).toBeVisible()
  await expect(page.getByText('Customize Your Blink')).toBeVisible()
})

// Test: Template builder displays information
test('should display template information in builder', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Check template name and description
  await expect(page.getByRole('heading', { name: 'QR Code Generator' })).toBeVisible()
  await expect(page.getByText(/Generate QR codes/i)).toBeVisible()

  // Check for badges
  await expect(page.getByText('utilities')).toBeVisible()
})

// Test: 2-step wizard
test('should show 2-step wizard in template builder', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Check for step indicators
  await expect(page.getByText('Customize', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Preview & Publish')).toBeVisible()
})

// Test: Pre-filled form
test('should pre-fill form with template defaults', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Check that title is pre-filled
  const titleInput = page.getByLabel('Blink Title')
  await expect(titleInput).toHaveValue(/QR Code/i)

  // Check that description is pre-filled
  const descriptionInput = page.getByLabel('Description')
  await expect(descriptionInput).not.toBeEmpty()

  // Check that price is pre-filled
  const priceInput = page.getByLabel(/Price per Use/i)
  await expect(priceInput).not.toBeEmpty()
})

// Test: Helper text
test('should show helper text for fields', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Check for helper text
  await expect(page.getByText('What should people call your Blink?')).toBeVisible()
  await expect(page.getByText('Help users understand what they\'ll get')).toBeVisible()
})

// Test: Platform fee calculation
test('should calculate and display platform fee', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Wait for price to be filled
  await page.waitForTimeout(500)

  // Should show platform fee calculation
  await expect(page.getByText(/Platform fee/i)).toBeVisible()
  await expect(page.getByText(/You earn:/i)).toBeVisible()
})

// Test: Navigate to step 2
test('should navigate to step 2 when clicking Next', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Fill in required fields if needed
  const titleInput = page.getByLabel('Blink Title')
  await titleInput.clear()
  await titleInput.fill('My Test QR Generator')

  const descriptionInput = page.getByLabel('Description')
  await descriptionInput.clear()
  await descriptionInput.fill('This is a test description for my QR code generator')

  // Click Next button
  await page.getByRole('button', { name: /Next Step/i }).click()

  // Wait for step 2
  await page.waitForTimeout(500)

  // Should show preview
  await expect(page.getByText('Preview Your Blink')).toBeVisible()
  await expect(page.getByText('My Test QR Generator')).toBeVisible()
})

// Test: Preview card in step 2
test('should show preview card in step 2', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Navigate to step 2 first
  const titleInput = page.getByLabel('Blink Title')
  await titleInput.clear()
  await titleInput.fill('My Test QR')

  const descriptionInput = page.getByLabel('Description')
  await descriptionInput.clear()
  await descriptionInput.fill('Test description for preview')

  await page.getByRole('button', { name: /Next Step/i }).click()
  await page.waitForTimeout(500)

  // Check preview card
  await expect(page.getByText('Preview Your Blink')).toBeVisible()
  await expect(page.getByText('My Test QR')).toBeVisible()
  await expect(page.getByText('Test description for preview')).toBeVisible()
})

// Test: Configuration summary
test('should show configuration summary in step 2', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Navigate to step 2
  await page.getByRole('button', { name: /Next Step/i }).click()
  await page.waitForTimeout(500)

  // Check for configuration details
  await expect(page.getByText('Configuration')).toBeVisible()
  await expect(page.getByText('API Endpoint:')).toBeVisible()
  await expect(page.getByText('Method:')).toBeVisible()
  await expect(page.getByText('Category:')).toBeVisible()
})

// Test: Back button
test('should allow going back to step 1', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Go to step 2
  await page.getByRole('button', { name: /Next Step/i }).click()
  await page.waitForTimeout(500)

  // Click back button
  await page.getByRole('button', { name: /Back/i }).click()
  await page.waitForTimeout(500)

  // Should be back on step 1
  await expect(page.getByText('Customize Your Blink')).toBeVisible()
})

// Test: Back to templates link
test('should have back to templates link', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Check for back link
  await expect(page.getByRole('link', { name: /Back to Templates/i })).toBeVisible()
})

// Test: Publish button
test('should show publish button in step 2', async ({ page }) => {
  await page.goto('/create/easy/qr-code-generator')

  // Navigate to step 2
  await page.getByRole('button', { name: /Next Step/i }).click()
  await page.waitForTimeout(500)

  // Check for publish button (will show "Connect Wallet to Publish" if not authenticated)
  const publishButton = page.getByRole('button', { name: /Publish/i })
  await expect(publishButton).toBeVisible()
})

// Test: Different templates
test('should work with Dad Joke template', async ({ page }) => {
  await page.goto('/create/easy/random-dad-joke')

  await expect(page.getByRole('heading', { name: 'Random Dad Joke' })).toBeVisible()
  // Description is also visible
  await expect(page.locator('p').filter({ hasText: /dad joke/i }).first()).toBeVisible()
})

test('should work with Crypto Price template', async ({ page }) => {
  await page.goto('/create/easy/crypto-price')

  await expect(page.getByRole('heading', { name: 'Crypto Price Checker' })).toBeVisible()
  await expect(page.getByText(/real-time/i)).toBeVisible()
})

// Test: Invalid template ID
test('should handle invalid template ID gracefully', async ({ page }) => {
  await page.goto('/create/easy/invalid-template-id')

  // Should show "Template Not Found" message
  await expect(page.getByText('Template Not Found')).toBeVisible()
  await expect(page.getByRole('link', { name: /Back to Templates/i })).toBeVisible()
})

// Test: Mobile viewport
test('should work on mobile viewport', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 })

  // Navigate to template gallery
  await page.goto('/create/easy')

  // Should display templates in mobile layout
  await expect(page.getByText('Easy Mode: Pick a Template')).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('heading', { name: 'QR Code Generator' }).first()).toBeVisible()
})
