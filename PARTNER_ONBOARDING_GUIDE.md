# Partner Guide: Onboarding Realtors to the School Explorer

A quick, practical guide to getting your realtors set up with the free Dream
Neighborhood **School Explorer** — even the ones who will never lift a finger.

Everything happens from the **Customer List** page after you sign in at
**app.dreamneighborhoodschools.com**.

---

## The short version

You can set a realtor up completely **for** them. No signup, no email
verification, no password required. The moment you add them with their website
domain, the School Explorer is live on their site. They don't have to do
anything — and it keeps working whether or not they ever log in.

You have three tools:

1. **Add customer** — set up one realtor by hand.
2. **Import** — set up many realtors at once from a pasted list.
3. **View as** — step into a realtor's account and configure everything for them.

---

## What you'll need for each realtor

Just four things:

| Field | Example | Notes |
| --- | --- | --- |
| **Email** | `jane@coastalrealty.com` | Their login later. Must be unique. |
| **Customer name** | `Jane Doe` or `Coastal Realty` | Shown in your list and on their account. |
| **Authorized domain** | `coastalrealty.com` | Their website. Enter the base domain — it covers every page and subdomain. |
| **Default address** | `1500 N 23rd St, Fort Pierce, FL` | Fallback location shown if a page has no address of its own. |

> **Tip:** The authorized domain is what makes the Explorer go live. Without it,
> the account exists but the popup/embed stays off until a domain is added.

---

## Option 1 — Add one realtor

1. Sign in at **app.dreamneighborhoodschools.com** and open **Customer List**.
2. Click **+ Add customer**.
3. Fill in the email, customer name, authorized domain, and default address.
4. Click **Add customer**.

That's it. The account is created, verified, and active. If the realtor has
already installed the one-line snippet on their site (or you install it for
them), the School Explorer is now working.

---

## Option 2 — Import a whole list

Best when you're onboarding many realtors at once.

1. On **Customer List**, click **Import**.
2. Either click **Choose file…** and select a **.csv**, **.tsv**, or **.txt** file,
   or paste one realtor per line in this order:

   ```
   email, customer name, authorized domain, default address
   ```

   Example:

   ```
   jane@coastalrealty.com, Jane Doe, coastalrealty.com, 1500 N 23rd St, Fort Pierce, FL
   john@sunsethomes.com, John Smith, sunsethomes.com, 742 Evergreen Ter, Springfield, IL
   ```

3. Click **Import**.
4. Review the summary — each row shows **Created**, **Skipped** (already exists),
   or **Error** with a short reason.

Notes:

- A header row (e.g. a line starting with "email") is ignored automatically.
- Duplicate emails are skipped, so it's safe to re-run an import.
- You can upload a CSV from Excel/Sheets, or paste straight from a spreadsheet (tabs work too).

---

## Option 3 — Configure it all yourself with "View as"

For the realtors who will never log in, you can do everything for them.

1. On **Customer List**, find the realtor and click **View as**.
2. You're now inside their account. A banner across the top reminds you whose
   account you're in.
3. Change anything you need — domain, default address, branding, upgrade
   settings, and so on. Changes save to **their** account.
4. When you're done, click **Stop & return to my account** in the banner.

---

## What the realtor experiences

- **They don't need to do anything for the product to work.** Once the domain
  is set and the snippet is on their site, the School Explorer runs on their
  listings automatically.
- **No password until they want one.** The first time a realtor visits
  **app.dreamneighborhoodschools.com** and tries to sign in, we email them a
  secure link to set their password. Until then, their Explorer keeps working.
- **No verification email to chase.** Accounts you create are already verified
  and active.

---

## Branding (White Label)

The popup and embed show: **"Dream Neighborhood School Explorer provided by …"**

- Set **your White Label name** in your own **Account Settings** to brand every
  realtor you onboard by default.
- A realtor can override this with their own **White Label name** in their
  Account Settings (or you can set it for them using **View as**).
- If a realtor leaves White Label blank, they automatically inherit your name.

---

## Installing the snippet (if the realtor hasn't already)

Adding the account turns the Explorer *on*; the realtor's site still needs the
one-line snippet so it can appear. If you're doing it for them, add this just
before the closing `</body>` tag on their site:

```html
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
```

That single line powers the floating popup on every page. (For an inline
in-page version, see the **Help** page in the app.)

---

## Frequently asked questions

**Do realtors have to verify their email?**
No. Accounts you create are already verified and active.

**What if I don't know a realtor's default address yet?**
You can add it later with **Edit** or **View as**. The domain is the important
part for going live.

**Can two realtors share the same website domain?**
No — each domain belongs to one account. If a domain is already taken, the
import/add will tell you.

**What happens if a realtor never logs in?**
Nothing changes — their School Explorer keeps working. They only need to sign
in if they want to manage settings themselves.

**Can I remove a realtor?**
Yes. Use **Disable** on their row. Their data is retained and can be re-enabled.

---

## Need help?

Use the **Contact us** page inside the app, or email
**support@dreamneighborhood.com**.
