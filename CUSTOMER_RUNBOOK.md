# School Explorer — Customer Runbook

**One-pager for new realtors & partners.**  
Send this when someone goes live (or paste into email / Notion).

---

## Quick links

| What | URL |
|------|-----|
| **Log in / sign up** | https://app.dreamneighborhoodschools.com/login |
| **Home (usage overview)** | https://app.dreamneighborhoodschools.com/dashboard |
| **Configure Explorer** (domains, colors, popup) | https://app.dreamneighborhoodschools.com/edit |
| **Upgrade Requests** (buyer ask-for-upgrade leads) | https://app.dreamneighborhoodschools.com/upgrade-requests |
| **Help** (platform install steps) | https://app.dreamneighborhoodschools.com/help |
| **Public install guide** | https://www.dreamneighborhoodschools.com/installation |
| **Partner install guide** | https://www.dreamneighborhoodschools.com/installation/partners |
| **Try the explorer** | https://www.dreamneighborhoodschools.com |

---

## 1. Log in

1. Open https://app.dreamneighborhoodschools.com/login  
2. Sign up (free) or sign in with your email + password.  
3. Verify your email if prompted, then you’ll land on **Home**.

School Explorer is **free forever** — no credit card required.

---

## 2. Authorize your website domain

The popup/embed only runs on domains you approve.

1. In the app, open **Configure Explorer**  
   → https://app.dreamneighborhoodschools.com/edit  
2. Add your site’s domain (e.g. `yourbrokerage.com`).  
   - Include www and non-www if you use both, or whatever hosts serve listings.  
   - Subdomains count separately (e.g. `listings.yourbrokerage.com`).  
3. Save.  
4. Optional: set accent color, popup corner, and tooltip text on the same page.

**Until a domain is authorized, the explorer will not appear on the site.**

---

## 3. Install the snippet

Paste **once** in a global footer / theme / “headers & footers” script so it loads on every listing page.

### Floating popup (most common)

```html
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
```

A school button appears in the corner and auto-detects the listing address.

### Optional: inline embed

```html
<div id="dream-schools-explorer"></div>
<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>
```

Place the `<div>` where you want the explorer on the page.

**Step-by-step for WordPress, Squarespace, Wix, IDX, etc.:**  
https://app.dreamneighborhoodschools.com/help  
or https://www.dreamneighborhoodschools.com/installation  

After install, open a listing page → you should see the popup button (or the inline panel). On **Home** in the app, detection should show the explorer as enabled/detected once traffic hits.

---

## 4. Where usage & upgrade requests live

| Need | Where |
|------|--------|
| Views / activity overview | **Home** → https://app.dreamneighborhoodschools.com/dashboard |
| Change domains / look & feel | **Configure Explorer** → `/edit` |
| Buyers who asked to upgrade to full **Neighborhood Explorer** | **Upgrade Requests from Your Homebuyers** → https://app.dreamneighborhoodschools.com/upgrade-requests |

Upgrade Requests are leads: homebuyers who want the paid Neighborhood Explorer. Reminder and special-offer emails can be sent from that page when you’re ready.

---

## 5. If the embed / popup is missing or disabled

Check these in order:

1. **Domain authorized?** Configure Explorer → domain matches the live URL (including www / subdomain).  
2. **Snippet on the page?** View page source and search for `embed.js`.  
3. **Hard refresh / cache** after publishing the theme.  
4. **Account still active?** If the account was deleted or disabled, the widget stops.  
5. **Wrong site?** Snippet must be on the site that serves the listings (not only a staging copy).

### Who to contact

| Channel | How |
|---------|-----|
| Contact form | https://www.dreamneighborhoodschools.com/contact |
| Email | support@dreamneighborhood.com |
| Your Dream Neighborhood contact | bill@motormouth.io |

Include: your account email, the live listing URL, and a screenshot if possible.

---

## Partners (website builders / IDX)

- White-label across client sites: https://www.dreamneighborhoodschools.com/installation/partners  
- Each client still needs an account (or your partner workflow) with **their** domains authorized.  
- When a client upgrades to Neighborhood Explorer, partner revenue share is handled through the Dream Neighborhood partnership program.

---

## Fair Housing note (for your team)

On the public School Explorer website, race/gender demographics default to **Limited**. Full demographics require an explicit acknowledgment. Partner popup/embed stay Limited for Fair Housing compliance on listing sites.

---

*Dream Neighborhood Schools · School Explorer · https://www.dreamneighborhoodschools.com*
