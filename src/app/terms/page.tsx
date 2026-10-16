import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

// Same look as the topic links elsewhere in the app.
const CHIP_CLASS =
  "inline-block rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const SECTIONS = [
  { id: "account", label: "Your account" },
  { id: "content", label: "Your content" },
  { id: "rules", label: "Content rules" },
  { id: "copyright", label: "Copyright" },
  { id: "reporting", label: "Reporting" },
  { id: "enforcement", label: "What happens" },
  { id: "service", label: "The service" },
  { id: "contact", label: "Contact" },
] as const;

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <div className="prose-article">
        <h1>Terms of Service</h1>
        <p>Last updated: October 16, 2026</p>
        <p>
          These terms are the rules for using Skrib, a blogging platform. By
          creating an account or using Skrib, you agree to them. If you do not
          agree, please do not use Skrib. The{" "}
          <Link href="/privacy">Privacy Policy</Link> explains how we handle
          your information.
        </p>
      </div>

      <aside
        aria-labelledby="short-version"
        className="my-8 rounded-xl border border-border bg-surface p-5"
      >
        <h2
          id="short-version"
          className="font-serif text-lg font-bold tracking-tight"
        >
          The short version
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>Your writing is yours. You allow Skrib to show it.</li>
          <li>Post only what you wrote or have the right to post.</li>
          <li>
            No hate against people for who they are, no threats, and no calls
            to commit crimes.
          </li>
          <li>
            No selling, no ads, no affiliate or shop links, and no gambling.
          </li>
          <li>
            Break the rules and we remove the content. Serious or repeated
            cases lose the account.
          </li>
          <li>
            See something wrong? Use the Report button, or write to us. See{" "}
            <a href="#reporting" className="underline underline-offset-4">
              Reporting
            </a>
            .
          </li>
        </ul>
      </aside>

      <nav aria-label="On this page" className="mb-10">
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          On this page
        </p>
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={CHIP_CLASS}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="prose-article">
        <h2 id="account" className="scroll-mt-20">
          Your account
        </h2>
        <ul>
          <li>
            You must be at least 13 years old. If you are under 18, you
            confirm that a parent or guardian allows you to use Skrib.
          </li>
          <li>
            Give correct information, and do not pretend to be another person
            or organisation.
          </li>
          <li>
            Keep your password secret. You are responsible for what happens
            under your account. If you think someone else used it, tell us at
            once.
          </li>
          <li>
            You can delete your posts at any time. You can also delete your
            account yourself in Settings. This permanently removes your
            content, with a few exceptions (see the Privacy Policy).
          </li>
        </ul>

        <h2 id="content" className="scroll-mt-20">
          Your content
        </h2>
        <p>
          You own what you write. Skrib does not claim ownership of your posts,
          series, notes, comments, captions, images or profile.
        </p>
        <p>
          To run Skrib, you give us a non-exclusive, worldwide, free permission
          to store, copy, display and distribute your content inside and
          through Skrib: on its pages, in lists and search, on topic pages, in
          link previews, in RSS feeds, in reposts by other people, in
          notifications, and in version history and backups. This permission
          does not let us sell your content or use it for anything else. It
          ends when you delete the content, except that copies in backups are
          removed on our normal schedule, and we cannot remove copies that
          other people already made outside Skrib, for example in an RSS
          reader.
        </p>
        <p>By publishing, you promise that:</p>
        <ul>
          <li>you wrote it, or you have permission to use it;</li>
          <li>it does not break these rules or the law;</li>
          <li>
            you name your sources and quote fairly, and credit people only for
            real contributions.
          </li>
        </ul>
        <p>
          On a post written together, each author makes the same promises for
          their own part. You are responsible for your content. Skrib does not
          check posts before they appear.
        </p>
        <p>
          <strong>Notes.</strong> A note is a short public text of up to 500
          characters, and it can have up to 4 images (JPG, PNG or WebP). Anyone can read it, also without an account, and the
          content rules below apply to it. You choose who can reply to your
          note, and you can hide replies under it; a hidden reply stays
          visible to the person who wrote it. We do not scan images automatically: we look at an image only when someone reports the note. When someone reports a note, we
          save a copy of it (see the Privacy Policy). We may hide or delete a
          note that breaks the rules. A deleted note is deleted together with
          its replies. You can delete your own notes at any time. A note that
          shares a story may quote a passage of that story (up to 300
          characters); the quote must come from that story.
        </p>

        <p>
          <strong>Email subscriptions.</strong> Readers can subscribe to an
          author to get new stories by email. An author cannot see or export
          the addresses and may not use the list for anything else. We may stop
          sending an author&apos;s emails while that account is suspended.
        </p>

        <p>
          <strong>Editors.</strong> An author may invite another person to
          edit a story as an editor. The author stays the owner of the story,
          and an editor gets no rights to it. An editor can edit the draft
          while holding the pen, but cannot delete it or change it once it is
          published. An editor can publish it only if the author allows that
          for this story, and the author can take that permission back at any
          time. The author
          chooses whether the story shows “Edited by” with the editor&apos;s
          name. Accepting the invitation means agreeing to this, and either
          side can end it at any time.
        </p>

        <h2 id="rules" className="scroll-mt-20">
          Content rules
        </h2>
        <p>
          Skrib is a place to read and write. These things are not allowed, in
          posts, series, notes, comments, repost captions, images, profiles or
          usernames:
        </p>
        <ul>
          <li>
            <strong>Hate and SARA.</strong> Content that attacks, insults,
            dehumanises or calls for hostility against people because of their
            ethnicity, religion, race or group (known in Indonesia as SARA), or
            because of their gender, sexual orientation, disability or
            nationality. You may write about these subjects and criticise
            ideas and beliefs. You may not attack people for who they are.
          </li>
          <li>
            <strong>Harassment and threats.</strong> Threats, bullying,
            stalking, publishing private information about someone (such as an
            address, phone number or identity document), and impersonation.
          </li>
          <li>
            <strong>Crime and violence.</strong> Encouraging, organising,
            praising or teaching crime or violence, including terrorism and
            extremism. Any sexual content involving children is removed at once
            and may be reported to the authorities.
          </li>
          <li>
            <strong>Selling and promotion.</strong> Selling or buying anything,
            ads and sponsored posts, affiliate, referral or commission links,
            links to shops, marketplaces or payment pages, groups for trading,
            and offers of loans, investments or crypto schemes. Links that
            support what you write, such as sources and references, are fine.
            A link whose purpose is to sell, advertise or earn money is not.
          </li>
          <li>
            <strong>Gambling.</strong> Online gambling in any form (judi
            online): promoting it, linking to betting, slot, casino or lottery
            sites, explaining how to join or win, sharing bonus or referral
            codes or mirror links, or hiding such links inside normal-looking
            posts.
          </li>
          <li>
            <strong>Spam and manipulation.</strong> Repeated or automatic
            posts, link farms, hidden links, keyword stuffing, fake accounts,
            and fake likes, reposts or reports.
          </li>
          <li>
            <strong>Explicit sexual content</strong> (pornography).
          </li>
          <li>
            <strong>Scams and harmful code.</strong> Phishing, malware, fake
            giveaways and anything meant to trick people out of money or data.
          </li>
          <li>
            <strong>Anything else that is against the law in Indonesia.</strong>
          </li>
          <li>
            <strong>Misuse of Skrib.</strong> Attacking the service, collecting
            data at scale, or working around its limits.
          </li>
        </ul>
        <p>If you are not sure whether something is allowed, ask us first.</p>

        <h2 id="copyright" className="scroll-mt-20">
          Copyright
        </h2>
        <p>
          Publish only text, images and other material that you made or have
          the right to use. Copying someone else is not allowed without
          permission: a whole article, a photo found online or a chapter of a
          book, even if you name the author. A short quote with its source is
          fine.
        </p>
        <p>
          If you believe your work was copied on Skrib, report it (see
          Reporting) and include:
        </p>
        <ul>
          <li>your name and how to reach you;</li>
          <li>
            what the original work is and where it can be found, or proof that
            you made it;
          </li>
          <li>the address of the page on Skrib;</li>
          <li>
            a statement that you are the owner or act for the owner, and that
            the information you gave is correct and sent in good faith.
          </li>
        </ul>
        <p>
          When a claim looks valid, we hide or remove the copied part and tell
          the author. The author can answer by email and explain why the use
          is allowed. We may restore the content if the claim does not hold,
          unless the claimant takes legal steps. Accounts with repeated valid
          claims are closed.
        </p>

        <h2 id="reporting" className="scroll-mt-20">
          Reporting
        </h2>
        <p>There are two ways to tell us about a problem:</p>
        <ul>
          <li>
            <strong>With the Report button.</strong> When you are signed in,
            use Report on a post, a series, a comment, a note (the flag icon) or a repost caption, and choose a
            reason: <em>Spam</em> (selling, ads, spam links),{" "}
            <em>Harassment or hate</em> (SARA, threats),{" "}
            <em>Inappropriate or explicit content</em>, <em>Illegal content</em>{" "}
            (gambling, calls to crime, anything unlawful) or{" "}
            <em>Something else</em> (for a copyright problem, add the link to
            the original in the note). Only the site owner sees reports. The
            author is not told who reported.
          </li>
          <li>
            <strong>By email.</strong> If you do not have an account, or you
            have a copyright claim or a legal request, write to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Put the
            address of the page in the subject.
          </li>
        </ul>
        <p>
          We review reports as quickly as we can and aim to act on clear
          violations within 24 hours. Threats and child safety come first.
          Please report in good faith: false or abusive reports can lead to
          limits on your account.
        </p>

        <h2 id="enforcement" className="scroll-mt-20">
          What happens when the rules are broken
        </h2>
        <ul>
          <li>
            <strong>Removal.</strong> We may hide or remove a post, series,
            note, comment, caption, image or cover. A hidden post or note is
            no longer visible to readers. A removed series is deleted, but the
            stories in it stay.
          </li>
          <li>
            <strong>Notice.</strong> We tell the author in the app and by email what was
            removed and why, unless the law or an investigation does not allow
            it, or the case is urgent.
          </li>
          <li>
            <strong>Warning and closing.</strong> A first, minor violation
            usually gets a removal and a warning. Repeated violations close the
            account. A serious violation can close it at once, without a
            warning: sexual content involving children, terrorism, threats of
            violence, gambling or selling spam, accounts made for spam, and
            repeated copyright violations.
          </li>
          <li>
            <strong>Suspension.</strong> We may suspend an account, for a set
            time (1, 7 or 30 days) or until we lift the suspension. A suspended
            account can still sign in, read, and delete its own posts, series,
            notes and comments, but cannot publish, create or change a series,
            write a note, comment, like, follow, repost or report until the
            suspension ends or we lift it. Posts that are already
            published stay public unless we hide them.
          </li>
          <li>
            <strong>Closing an account</strong> also removes its content.
          </li>
          <li>
            <strong>Appeal.</strong> If you think a decision is wrong, reply to
            our email within 14 days and explain. We will look again, and we
            may restore the content.
          </li>
          <li>
            <strong>The law.</strong> We may remove content or share
            information when Indonesian law or an official order requires it.
          </li>
          <li>
            We may also act on content not listed here when it clearly harms
            people or Skrib.
          </li>
        </ul>

        <h2 id="service" className="scroll-mt-20">
          The service
        </h2>
        <p>
          Skrib is provided as it is. We work to keep it running, but we cannot
          promise that it will always work or that nothing will be lost, so
          keep a copy of what matters to you. We may change or stop features.
        </p>
        <p>
          To the extent the law allows, we are not responsible for content that
          users post, or for losses that come from using Skrib. If someone
          makes a claim against Skrib because of something you posted, you
          agree to cover the reasonable costs and damages that result.
        </p>
        <p>
          We may update these terms. The date at the top shows the latest
          version, and for important changes we will show a notice on the site.
          If you keep using Skrib after a change, you accept it. These terms
          are governed by the laws of Indonesia. If there is a disagreement, we
          will first try to settle it by talking; if that fails, the courts of
          Indonesia decide.
        </p>

        <h2 id="contact" className="scroll-mt-20">
          Contact
        </h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}