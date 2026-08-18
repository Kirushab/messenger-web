# v430 — Ideas & Bugs feedback widget

- Added a new **Идеи и баги** tile to the chat widget/attachment panel.
- Added a full-screen feedback page with three request types: new widget, feature idea, and bug report.
- Bug reports can include reproduction steps and automatically attach app/browser/viewport context.
- Users can see their own submitted requests and current statuses inside the page.
- Added migration `179_feedback_requests.sql` with RLS: users can submit/read their own requests; console admins can read/update all requests.
