"use client";

import { AppShell } from "@/components/app/AppShell";

const SNIPPET = `<script src="https://www.dreamneighborhoodschools.com/embed.js" async></script>`;

export default function PartnerGuidePage() {
  return (
    <AppShell active="owner">
      {() => <PartnerGuide />}
    </AppShell>
  );
}

function PartnerGuide() {
  function printGuide() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Print rules: hide app chrome + the toolbar, and let the guide flow. */}
      <style>{`
        @media print {
          aside, header, footer, .no-print { display: none !important; }
          main { overflow: visible !important; padding: 0 !important; }
          .pg-card { box-shadow: none !important; border: none !important; }
          a[href]:after { content: "" !important; }
        }
      `}</style>

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <a
          href="/owner"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Back to Customer List
        </a>
        <button
          onClick={printGuide}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          Print / Save as PDF
        </button>
      </div>

      <article className="pg-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="border-b border-slate-100 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">
            Partner Guide
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            Onboarding Realtors to the School Explorer
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            A quick, practical guide to getting your realtors set up with the free Dream Neighborhood
            School Explorer — even the ones who will never lift a finger. Everything happens on the{" "}
            <strong>Customer List</strong> page after you sign in at{" "}
            <span className="font-semibold text-ink-900">app.dreamneighborhoodschools.com</span>.
          </p>
        </header>

        <Section title="The short version">
          <p>
            You can set a realtor up completely <strong>for</strong> them. No signup, no email
            verification, no password required. The moment you add them with their website domain,
            the School Explorer is live on their site. It keeps working whether or not they ever
            log in.
          </p>
          <p className="mt-3">You have four tools:</p>
          <ul className="mt-2 space-y-1.5">
            <Li><strong>Add customer</strong> — set up one realtor by hand.</Li>
            <Li><strong>Import</strong> — set up many realtors at once from a CSV file or pasted list.</Li>
            <Li><strong>View as</strong> — step into a realtor's account and configure everything for them.</Li>
            <Li><strong>Send Login Link</strong> — email a realtor you already added a personalized, one-time link so they can sign in and manage their own account.</Li>
          </ul>
        </Section>

        <Section title="What you'll need for each realtor">
          <p>Just four things:</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Field</th>
                  <th className="px-3 py-2 font-semibold">Example</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <Row field="Email" example="jane@coastalrealty.com" note="Their login later. Must be unique." />
                <Row field="Customer name" example="Jane Doe or Coastal Realty" note="Shown in your list and on their account." />
                <Row field="Authorized domain" example="coastalrealty.com" note="Their website. Enter the base domain — it covers every page and subdomain." />
                <Row field="Default address" example="1500 N 23rd St, Fort Pierce, FL" note="Fallback location shown if a page has no address of its own." />
              </tbody>
            </table>
          </div>
          <Callout>
            The authorized domain is what makes the Explorer go live. Without it, the account exists
            but the popup/embed stays off until a domain is added.
          </Callout>
        </Section>

        <Section title="Option 1 — Add one realtor">
          <ol className="space-y-1.5">
            <Li ordered>Sign in at app.dreamneighborhoodschools.com and open <strong>Customer List</strong>.</Li>
            <Li ordered>Click <strong>+ Add customer</strong>.</Li>
            <Li ordered>Fill in the email, customer name, authorized domain, and default address.</Li>
            <Li ordered>Click <strong>Add customer</strong>.</Li>
          </ol>
          <p className="mt-3">
            That's it. The account is created, verified, and active. Once the one-line snippet is on
            their site (theirs or yours), the School Explorer is working.
          </p>
        </Section>

        <Section title="Option 2 — Import a whole list">
          <p>Best when you're onboarding many realtors at once.</p>
          <ol className="mt-2 space-y-1.5">
            <Li ordered>On <strong>Customer List</strong>, click <strong>Import</strong>.</Li>
            <Li ordered>
              Paste one realtor per line in this order:
              <CodeBlock>{`email, customer name, authorized domain, default address`}</CodeBlock>
              Example:
              <CodeBlock>{`jane@coastalrealty.com, Jane Doe, coastalrealty.com, 1500 N 23rd St, Fort Pierce, FL
john@sunsethomes.com, John Smith, sunsethomes.com, 742 Evergreen Ter, Springfield, IL`}</CodeBlock>
            </Li>
            <Li ordered>Click <strong>Import</strong>.</Li>
            <Li ordered>
              Review the summary — each row shows <strong>Created</strong>, <strong>Skipped</strong>{" "}
              (already exists), or <strong>Error</strong> with a short reason.
            </Li>
          </ol>
          <ul className="mt-3 space-y-1.5">
            <Li>A header row (e.g. a line starting with "email") is ignored automatically.</Li>
            <Li>Duplicate emails are skipped, so it's safe to re-run an import.</Li>
            <Li>You can paste straight from a spreadsheet (tabs work too).</Li>
          </ul>
        </Section>

        <Section title={`Option 3 — Configure it all yourself with "View as"`}>
          <p>For the realtors who will never log in, you can do everything for them.</p>
          <ol className="mt-2 space-y-1.5">
            <Li ordered>On <strong>Customer List</strong>, find the realtor and click <strong>View as</strong>.</Li>
            <Li ordered>You're now inside their account. A banner across the top reminds you whose account you're in.</Li>
            <Li ordered>Change anything you need — domain, default address, branding, upgrade settings. Changes save to <strong>their</strong> account.</Li>
            <Li ordered>When you're done, click <strong>Stop &amp; return to my account</strong> in the banner.</Li>
          </ol>
        </Section>

        <Section title="Option 4 — Let a realtor manage their own account (“Send Login Link”)">
          <p>
            Use this <strong>after</strong> you've added a realtor, when you want them to be able to
            sign in and change their own settings. It is <strong>not</strong> the self-signup link from
            your Account Settings — that link is for realtors creating a brand-new account themselves.
          </p>
          <ol className="mt-2 space-y-1.5">
            <Li ordered>On <strong>Customer List</strong>, find the realtor (or tick several).</Li>
            <Li ordered>Click <strong>Send Login Link</strong> (per row, or the bulk button when multiple are selected).</Li>
            <Li ordered>
              They get a branded email with a <strong>personalized, one-time first-login link</strong>.
              Clicking it lets them set a password and manage their own School Explorer.
            </Li>
          </ol>
          <Callout>
            You can edit the wording of that email under <strong>Account Settings → “Send Login Link”
            email message</strong>. Their Explorer keeps working whether or not they ever log in.
          </Callout>
        </Section>

        <Section title="What the realtor experiences">
          <ul className="space-y-1.5">
            <Li><strong>They don't need to do anything for the product to work.</strong> Once the domain is set and the snippet is on their site, the School Explorer runs on their listings automatically.</Li>
            <Li><strong>No password until they want one.</strong> You can proactively email them a first-login link with <strong>Send Login Link</strong> (above). Or, the first time a realtor visits app.dreamneighborhoodschools.com and tries to sign in, we email them the same secure link to set their password. Until then, their Explorer keeps working.</Li>
            <Li><strong>No verification email to chase.</strong> Accounts you create are already verified and active.</Li>
          </ul>
        </Section>

        <Section title="Branding (White Label)">
          <p>
            The popup and embed show:{" "}
            <em>"Dream Neighborhood School Explorer provided by …"</em>
          </p>
          <ul className="mt-2 space-y-1.5">
            <Li>Set <strong>your White Label name</strong> in your own Account Settings to brand every realtor you onboard by default.</Li>
            <Li>A realtor can override this with their own White Label name (or you can set it for them using <strong>View as</strong>).</Li>
            <Li>If a realtor leaves White Label blank, they automatically inherit your name.</Li>
          </ul>
        </Section>

        <Section title="Installing the snippet (if the realtor hasn't already)">
          <p>
            Adding the account turns the Explorer <em>on</em>; the realtor's site still needs the
            one-line snippet so it can appear. If you're doing it for them, add this just before the
            closing <code className="rounded bg-slate-100 px-1">&lt;/body&gt;</code> tag on their site:
          </p>
          <CodeBlock>{SNIPPET}</CodeBlock>
          <p className="mt-2">
            That single line powers the floating popup on every page. (For an inline in-page version,
            see the <strong>Help</strong> page in the app.)
          </p>
        </Section>

        <Section title="Frequently asked questions">
          <Faq q="Do realtors have to verify their email?">
            No. Accounts you create are already verified and active.
          </Faq>
          <Faq q="What if I don't know a realtor's default address yet?">
            You can add it later with <strong>Edit</strong> or <strong>View as</strong>. The domain
            is the important part for going live.
          </Faq>
          <Faq q="Can two realtors share the same website domain?">
            No — each domain belongs to one account. If a domain is already taken, the import/add
            will tell you.
          </Faq>
          <Faq q="What happens if a realtor never logs in?">
            Nothing changes — their School Explorer keeps working. They only need to sign in if they
            want to manage settings themselves.
          </Faq>
          <Faq q="Can I remove a realtor?">
            Yes. Use <strong>Disable</strong> on their row. Their data is retained and can be
            re-enabled.
          </Faq>
        </Section>

        <Section title="Need help?">
          <p>
            Use the <strong>Contact us</strong> page inside the app, or email{" "}
            <a href="mailto:support@dreamneighborhood.com" className="font-semibold text-brand-700 hover:underline">
              support@dreamneighborhood.com
            </a>
            .
          </p>
        </Section>
      </article>

      <div className="no-print mt-5 flex justify-end">
        <button
          onClick={printGuide}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-slate-100 pt-5 first:border-0 first:pt-0">
      <h2 className="text-lg font-extrabold text-ink-900">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Li({ children, ordered }: { children: React.ReactNode; ordered?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${ordered ? "bg-brand-500" : "bg-slate-300"}`}
        aria-hidden
      />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Row({ field, example, note }: { field: string; example: string; note: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-semibold text-ink-900">{field}</td>
      <td className="px-3 py-2 font-mono text-[12px] text-slate-600">{example}</td>
      <td className="px-3 py-2 text-slate-600">{note}</td>
    </tr>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-900">
      <strong className="font-bold">Tip:</strong> {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-slate-800">
      {children}
    </pre>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="font-bold text-ink-900">{q}</p>
      <p className="mt-0.5 text-slate-600">{children}</p>
    </div>
  );
}
