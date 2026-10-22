// The sections of Admin Management, shared by the page and the sidebar.
//
// Kept here rather than in either one because both need the same list: the
// sidebar renders them as sub-items, and the page decides what to show from
// ?section=. Two copies would drift the first time a section is renamed.
//
// `entry` is the tab a section opens on. A section can hold several tabs -
// Victim Accounts covers verified, unverified and deleted - and SECTION_OF
// maps every tab back to its section so the sidebar still highlights the
// right thing when a filter inside the page changes the tab.
export const ADMIN_SECTIONS = [
  { key: "admins", label: "Admin Management", entry: "admins", superOnly: true,
    hint: "Officer accounts for this desk." },
  { key: "victims", label: "Victim Accounts", entry: "victims", superOnly: false,
    hint: "Everyone who has registered, verified or not." },
  { key: "id-review", label: "ID Review", entry: "id-review", superOnly: false,
    hint: "IDs waiting to be checked before a woman can file." },
  { key: "contacts", label: "Contacts & Officials", entry: "contacts", superOnly: true,
    hint: "The hotlines the app shows, and who holds each office." },
  { key: "history", label: "Log History", entry: "history", superOnly: true,
    hint: "Who did what, and when." },
  { key: "my-account", label: "My Account", entry: "my-account", superOnly: false,
    hint: "Your own password and details." },
];

export const SECTION_ENTRY = Object.fromEntries(
  ADMIN_SECTIONS.map((x) => [x.key, x.entry])
);

export const SECTION_OF = {
  admins: "admins",
  victims: "victims",
  unverified: "victims",
  "deleted-victims": "victims",
  "id-review": "id-review",
  contacts: "contacts",
  history: "history",
  "my-account": "my-account",
};

// What an officer sees first when they press Admin Management in the sidebar.
// A plain officer has no Admins section, so they land on Victim Accounts.
export function defaultSection(isSuper) {
  return isSuper ? "admins" : "victims";
}
