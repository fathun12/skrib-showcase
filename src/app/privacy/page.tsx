import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-180 px-4 py-10 md:px-8">
      <div className="prose-article">
        <h1>Privacy Policy</h1>
        <p>Last updated: October 16, 2026</p>

        <p>
          Skrib is a blogging platform. This page explains what information we
          collect when you use it and how we use it.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Sign-in with Google:</strong> your email address, name and
            profile picture, as provided by Google. We do not access your
            Gmail, contacts, Drive or any other Google data.
          </li>
          <li>
            <strong>Sign-in with email:</strong> your email address and a
            password. Passwords are handled by our authentication provider and
            are not stored in readable form.
          </li>
          <li>
            <strong>Profile and content:</strong> the username, display name,
            bio, and the posts you write.
          </li>
          <li>
            <strong>Topics:</strong> up to five topics you give a story when
            you publish it. They are public: they appear at the end of the
            story and on a page that lists every story with that topic.
          </li>
          <li>
            <strong>Search (stories and notes):</strong> the words you search for are used only to
            show the results. Skrib does not save them in its database and does
            not link them to your account. They are part of the page address,
            so, like any web address, they can appear in the logs of our
            hosting provider, and in an error report if an error happens right
            after a
            search.
          </li>
          <li>
            <strong>Version history:</strong> while you write, we keep older
            copies of your post (title, subtitle, text and language), at most
            the 30 newest, so you can go back to an earlier version. Only you
            can see them, and on a post written together with others, only the
            author who is editing. They are deleted with the post. Text you
            delete from a post can therefore stay in these copies until the
            post is deleted or newer copies replace it.
          </li>
          <li>
            <strong>Likes, reposts and follows:</strong> which posts you like
            and repost, and which authors you follow. Your reposts are public.
            A repost can carry a short caption; the caption is public too, and
            you can edit or remove it at any time.
          </li>
          <li>
            <strong>Saved posts:</strong> which posts you save. Only you can
            see this list.
          </li>
          <li>
            <strong>Hidden from For you:</strong> the authors and topics you
            choose to hide from the For you tab. Only you can see this list,
            you can undo any of them in Settings, and they are deleted with
            your account.
          </li>
          <li>
            <strong>Lists:</strong> the names of the lists you make to group
            your saved stories, and which saved stories are in each. Only you
            can see them. A story leaves its lists when you remove it from
            Saved, and your lists are deleted with your account.
          </li>
          <li>
            <strong>Reading progress:</strong> when you are signed in and read
            a story that is not yours, we remember how far you got, so you can
            continue later on any device. Only you can see it. A story you
            finish is forgotten, and you can remove any place from the
            Continue reading list on the Saved page. Stories you started
            show a small mark in the story lists.
          </li>
          <li>
            <strong>Notifications:</strong> when someone follows you, likes,
            reposts or comments on your post (or on a post you co-wrote),
            replies to your comment, likes or replies to one of your notes, or
            credits you on a post, we store a
            short note for you (who and which post), and
            we remember when you last opened your notifications. Only you can
            see them. The same list also shows new stories and reposts from
            the people you follow; those are worked out when you open the
            page, not stored as notes.
          </li>
          <li>
            <strong>Comments:</strong> the comments and replies you write,
            together with your account. They are public. You can delete your
            own comments at any time, and they are deleted with your account.
          </li>
          <li>
            <strong>Mentions in comments and stories:</strong> when you
            mention someone with @username in a comment, or in a story you
            publish, we store who was mentioned, together with the comment or
            the story, and send them a notification (not if they blocked or
            muted you). A story notifies a person once, when it is published,
            never from a draft. In a story the mention is a public link to the
            person&apos;s profile, and it follows their username if they
            change it. The record is deleted with the comment or the story.
          </li>
          <li>
            <strong>Series:</strong> the series you create: its title,
            description and cover image, and which of your own stories are in
            it and in what order, together with your account. A series is
            public when it has at least one published story. You can change or
            delete a series at any time; deleting it does not delete your
            stories. Your series are deleted with your account.
          </li>
          <li>
            <strong>Credits:</strong> when an author credits someone for a
            story (for example as editor or illustrator), we store who was
            credited, their role and who added them. A person with an account
            must accept first and can remove themself at any time. A person
            without an account is credited by the name the author typed.
            Credits are deleted with the story or with your account.
          </li>
          <li>
            <strong>Handover notes:</strong> when an author and an editor send
            a draft back and forth, the optional note (up to 280 characters) is
            stored in the notification of the other person. Only that person
            can see it, and it is deleted with the notification or with either
            account.
          </li>
          <li>
            <strong>Images:</strong> pictures you upload (in posts, as a cover
            for a post or a series, as a profile picture, or in a note) are stored with
            our image host,
            Cloudinary. An image can be seen by anyone who has its address.
          </li>
          <li>
            <strong>Notes:</strong> the short public notes you write and the
            replies you give, together with your account. Notes are public:
            anyone can read them, also without an account. You choose who can
            reply to a note. The author of a note can hide replies under it;
            a hidden reply can be seen only by the person who wrote it and by
            the author of the note. When you share a story into a note, the
            note shows a card with the story while the story is published.
            You can also quote a passage of the story (up to 300
            characters, taken from the story): the quote is stored with the
            note, shown only while the story is published, deleted with the
            note, and it cannot be edited.
            You can delete your own notes at any time, and they are deleted
            with your account. A note can be edited for 30 minutes after it is posted, and then it shows that it was edited. Earlier versions of the text are not kept, except the copy saved in a report. A note can have up to 4 images (JPG, PNG or WebP). They are stored with our image host, Cloudinary, together with the optional description you write for each one. They are public like the note, and they are removed when the note is deleted. Skrib does not scan images automatically: we look at an image only when someone reports the note. We also store which notes you like and which notes you
            repost. If you quote a note, your note shows the quoted note under your
            text; if the quoted note is deleted, your note stays and says so. Hashtags
            (such as #topic) in a note are stored with it so people can find it on a
            hashtag page, and the words of a published note are indexed so that note
            search can find it. The author of a note you repost or quote gets a
            notification. When you mention someone with @username, we store who the note
            mentions and send them a notification (not if they blocked or muted you). If
            you
            mute or block someone in Notes, we store that choice with your
            account, to hide their notes from you or to stop them from
            liking and replying to your notes. Only you can see your list
            (in Settings under Blocked and muted). The other person is not
            told. The list is deleted with your account, and an entry is
            also removed when the other person deletes their account.
          </li>
          <li>
            <strong>Highlights and private notes:</strong> when you highlight
            a passage of a story or add a private note to a highlight, we
            store the passage, its color and your note together with your
            account. Only you can see them: other readers and the author of
            the story cannot. You can delete a highlight, and its note, at
            any time, and they are deleted with your account. Like
            everything we store, they are kept in our database, so we cannot
            promise that nobody who operates the service could ever read
            them technically.
          </li>
          <li>
            <strong>Reports:</strong> if you report a post, a series, a
            comment, a note or a repost caption, we store which one (for a
            caption, also its text at that moment), the reason and your
            optional note, together with your account. Only the site owner can
            see reports. The author is not told who reported it. When you
            report a note, we also save a copy of it at that moment: its text,
            who wrote it and when, the note it replies to or quotes, if any, and its images (the picture files are kept for as long as the copy is kept). If the note shares a story, the copy also keeps the title of the story and the quoted passage, for as long as the copy is kept. The
            copy is kept even if the note is deleted afterwards, so that the
            report can still be judged. It is kept until a moderator decides
            on the report. After a decision it is kept for 90 days if the
            report was dismissed, and for 12 months if the note was hidden
            or deleted. Then it is deleted the next time we run the
            clean-up, which we do by hand, so it can be a little later. While
            an official request or a legal case is pending, we may keep it
            longer and mark it as on hold. If you delete your account, copies
            of your notes saved in reports that were not acted on are deleted
            with it; copies of notes that were hidden or deleted after a
            report, and copies on hold, stay until their date. If you
            reported something and delete your account, the report stays but
            is no longer linked to you.
          </li>
          <li>
            <strong>Moderation:</strong> when a moderator hides or deletes one
            of your posts or notes, or deletes one of your comments or series,
            we store a notice for you with what happened, the title of the
            post or series (or the start of the comment or note), the reason,
            an optional note and the date. Only
            you can see it, and it is deleted with your account. We also send
            you an email with the same information, through Brevo. Neither the
            notice nor the email names the moderator. Separately, we keep a
            private record of each moderation decision (the title of the post
            or series, the reason, the note and the date). It is kept after
            the post, the series or the account is deleted, so that earlier
            cases of an author can be
            seen, and only the site owner can see it. If a moderator suspends
            your account, the same goes for the suspension: you get a notice
            and an email with the reason and the optional note, and we keep a
            private record of the suspension (the reason, the note and the
            dates), also after it is lifted.
          </li>
          <li>
            <strong>Requests from authorities:</strong> if an authority asks us
            for information, we keep a record of the request and of what we
            handed over: the date, who asked, the kind of information and a
            short summary. This record is kept after the account concerned is
            deleted, and only the site owner can see it.
          </li>
          <li>
            <strong>Story views and reads:</strong> when someone opens a
            published story, Skrib adds to a daily total for that story: one
            view (about 8 seconds on the page) and one read (scrolled most of
            the way through). This is a plain count: we do not store your IP
            address, a cookie, your account or any other detail about you for
            it. Your browser keeps a small marker in temporary storage for the
            open tab, so the same story is not counted twice in that tab; it
            disappears when you close the tab. Views and reads by the authors
            of a story are not counted. The author of a story sees these
            totals, together with the number of likes, comments and saves the
            story got and the number of new followers, per day and per story,
            but never who they came from. The totals are not linked to any
            account, so deleting an account does not change them, and they are
            deleted with the story.
          </li>
          <li>
            <strong>Email subscriptions:</strong> if you subscribe to an
            author, we store your email address (for a signed-in reader, the
            confirmed address of the account) and which author you follow by
            email. We use it only to send you that author&apos;s new stories.
            The emails are sent through Brevo, which may count whether an
            email was opened or a link in it was clicked. Every email has an
            unsubscribe link. When you unsubscribe, the entry is kept for 30
            days so you are not signed up again by accident, and then it is
            deleted. A subscription that was never confirmed is deleted after
            30 days. Your subscriptions are also deleted with your account.
            Authors see only how many subscribers they have, never the
            addresses.
          </li>
          <li>
            <strong>Activity counters:</strong> short-lived counts of how often
            your account performs actions such as saving, liking or uploading.
            We use them only to prevent abuse.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          We use this information only to run Skrib: to sign you in, show your
          profile, and save and publish your posts. We do not sell your data
          and we do not use it for advertising.
        </p>

        <h2>What is public</h2>
        <p>
          Your username, display name, bio, profile picture and any post you
          publish are visible to everyone. The authors you follow and the
          people who follow you are listed on your profile. Posts show how many
          likes they have. The stories you repost are listed on the Reposts
          tab of your profile and shown to the people who follow you, with the
          caption you wrote, if any. Comments
          you write on a post are public too, with
          your name and profile picture; the authors of a post can delete
          comments on it. A post you write together with other people shows
          the name and profile picture of each author and appears on the
          profile of each author. A co-author can leave a post at any time, and
          the post owner can remove one; the name then disappears from the
          post. People credited on a story are listed in a Credits section at
          the end of it, with their role, but only after they accept (a person
          without an account is shown as soon as the author adds the name).
          An author can also invite an editor to a draft. An editor can read
          and edit the draft, is not shown as an author, and appears on the
          story only as “Edited by” when the author chooses to show it.
          Drafts are visible only to you and to the co-authors and editors you
          invite. Your email address is never shown publicly.
        </p>

        <h2>Cookies and device storage</h2>
        <p>
          We use cookies to keep you signed in and to remember your light or
          dark theme choice. If you change the reading options on an article
          (text size, column width, sepia, progress line), one more small
          cookie remembers them for one year on your device. We do not use
          advertising or tracking cookies.
        </p>
        <p>
          Skrib keeps one small page of its own on your device, so it can show
          a short offline message when your connection drops. It is the same
          for everyone, holds no personal data and is never sent anywhere.
        </p>
        <p>
          The pictures inside saved stories are kept on your device in a
          separate cache of at most 100 files, so a saved story can show them
          offline. They are removed when you sign out or sign in to another
          account. The pictures of a story you unsave stay until newer ones
          replace them.
        </p>
        <p>
          When you press Save under a story while you are signed in, your
          browser also keeps a copy of that story, and of your Saved page, so
          you can read it without a connection. A copy is the page as it was
          shown to you, so it includes your name and profile picture in the
          page header. It stays on your device and is never sent anywhere. Up
          to 50 stories are kept, and older copies are dropped when there are
          more. A copy is removed when you remove the story from Saved. All
          copies are removed when you sign out or when a different account is
          used in that browser, the next time Skrib opens. The pictures and
          files these pages use are kept as well, up to a limit. Clearing the
          site data in your browser removes everything. On a shared device,
          sign out when you are done.
        </p>

        <h2>Error reports</h2>
        <p>
          When something breaks in Skrib, the error is sent to Sentry, a
          service that helps us find and fix bugs. Only errors are reported.
          We do not record sessions, screens or performance.
        </p>
        <p>An error report contains:</p>
        <ul>
          <li>the error message and the technical trace of where it happened;</li>
          <li>the version of Skrib that was running;</li>
          <li>your browser language and time zone;</li>
          <li>
            the addresses of pages you opened shortly before the error,
            including pages your browser loaded in the background, and which
            parts of a page you clicked (as a technical element name).
          </li>
        </ul>
        <p>
          We have set it up so that your IP address, cookies, request headers
          and anything you typed into a form are not sent, and so that your
          name, email address and account ID are not attached. Approximate
          location (country, region and city) is not kept either: we have set
          Sentry to discard it. The data is stored in the European Union.
        </p>

        <h2>Services we rely on</h2> 
        <p>
          Skrib is hosted on Vercel, your data is stored with Supabase, images
          are stored with Cloudinary, confirmation and password reset emails,
          and emails about moderation decisions, are sent through Brevo, and
          error reports are sent to Sentry. Email you send to our contact
          address is received and forwarded to our mailbox by ImprovMX. These
          providers process data on our behalf to make the service work.
        </p>

        <h2>Deleting your data</h2>
        <p>
          You can delete your posts at any time from your dashboard. You can
          also delete your account yourself, in Settings under Delete account.
          This permanently deletes your profile, your posts and their version
          history, your series, your notes, your comments, likes, reposts,
          follows, saved
          posts,
          reading progress and notifications, and removes the images you
          uploaded from our image host. It cannot be undone.
        </p>
        <p>A few things are not removed:</p>
        <ul>
          <li>
            A passage quoted from a story that is saved in a report copy
            stays with the copy.
          </li>
          <li>
            The private record of moderation decisions, including
            suspensions, which only the site owner can see (see Moderation
            above).
          </li>
          <li>
            The copy of a note that was saved when someone reported it, if the
            report led to the note being hidden or deleted, or if it is on
            hold, until its date (see Reports above). Also the record of a
            request from an authority (see above). Images saved in a report copy stay with the copy.
          </li>
          <li>
            Text you wrote on a post that someone else owns, as a co-author,
            stays part of that post. Your name is removed from it.
          </li>
          <li>
            Copies in our backups, which are removed on our normal schedule,
            and copies other people made outside Skrib, for example in an RSS
            reader. An image can also stay visible for a short time after it
            is deleted, because of caching.
          </li>
        </ul>
        <p>
          An administrator account cannot be deleted from Settings, and if one
          of your posts has co-authors, you must remove them first. If you
          cannot delete your account, contact us at the address below.
        </p>

        <h2>Contact</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
