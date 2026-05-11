import asyncio
from playwright.async_api import async_playwright
import os

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Define verification directory
        vdir = "/home/jules/verification"
        os.makedirs(vdir, exist_ok=True)

        try:
            print("Navigating to Homepage...")
            await page.goto("http://localhost:5173", wait_until="networkidle")
            await page.screenshot(path=f"{vdir}/01_homepage.png")
            print("Homepage screenshot saved.")

            # Check for Cookie Notice and click Accept
            if await page.query_selector("text=Принять"):
                print("Accepting cookies...")
                await page.click("text=Принять")
                await asyncio.sleep(0.5)

            # Navigate to Catalog
            print("Navigating to Catalog...")
            await page.click("text=Перейти в каталог")
            await page.wait_for_load_state("networkidle")
            await page.screenshot(path=f"{vdir}/02_catalog.png")
            print("Catalog screenshot saved.")

            # Scroll to Footer
            print("Verifying Footer...")
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1)
            await page.screenshot(path=f"{vdir}/03_footer.png")

            # Verify Privacy Policy link
            print("Checking Privacy Policy...")
            await page.click("footer >> text=Конфиденциальность")
            await page.wait_for_load_state("networkidle")
            await page.screenshot(path=f"{vdir}/04_privacy.png")

            # Verify Returns
            print("Checking Returns Policy...")
            await page.goto("http://localhost:5173/returns")
            await page.wait_for_load_state("networkidle")
            await page.screenshot(path=f"{vdir}/05_returns.png")

            print("Verification complete.")

        except Exception as e:
            print(f"Error during verification: {e}")
            await page.screenshot(path=f"{vdir}/error_screenshot.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
