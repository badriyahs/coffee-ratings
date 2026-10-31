# Coffee Ratings

On the search for the best coffee in Kuwait.

- `index.html` — password screen, today's coffee (stars, heart, comment), ratings table
- `admin.html` — private: add each day's coffee (café, date, coffee, beans, description)
- `js/config.js` — Firebase web config (`firebase: null` = preview mode in this browser)
- `firestore.rules` — paste into Firebase console → Firestore → Rules

Firebase accounts (Authentication → Email/Password, made in the console):
- `taster@<project>.firebaseapp.com` — its password is the site password
- `badriyah@<project>.firebaseapp.com` — admin page (sign in with username `badriyah`)
