import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "nexus-96795";
const FX = 36.6243;
const CUTOVER_DATE = "2026-09-29";

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }),
);

async function getUsers() {
  let pageToken;
  const users = [];
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

async function resolveUser() {
  if (typeof args.uid === "string") return auth.getUser(args.uid);
  if (typeof args.email === "string") return auth.getUserByEmail(args.email);

  const users = await getUsers();
  console.table(
    users.map((user, index) => ({
      option: index + 1,
      email: user.email || "",
      displayName: user.displayName || "",
      uid: user.uid,
    })),
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "\nEscribe el número de TU cuenta principal de NEXUS y presiona Enter: ",
  );
  rl.close();
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= users.length)
    throw new Error("Selección inválida. No se modificó ninguna cuenta.");
  return users[index];
}

function entity(id, uid) {
  const now = Date.now();
  return {
    id,
    userId: uid,
    createdAt: now,
    updatedAt: now,
    source: "user",
  };
}

const user = await resolveUser();
const ref = db.collection("users").doc(user.uid);
const snapshot = await ref.get();
if (!snapshot.exists)
  throw new Error("La cuenta seleccionada no tiene workspace en Firestore.");

const docData = snapshot.data();
const workspace = structuredClone(docData?.workspace);
if (!workspace || !workspace.user)
  throw new Error("No se encontró un workspace NEXUS válido.");

workspace.financialAccounts ??= [];
workspace.debts ??= [];

const upsertAccount = ({ id, name, kind, currency, balance }) => {
  const current = workspace.financialAccounts.find((item) => item.id === id);
  if (current) {
    Object.assign(current, {
      name,
      kind,
      currency,
      balance,
      userId: user.uid,
      source: "user",
      updatedAt: Date.now(),
    });
    return current;
  }
  const created = {
    ...entity(id, user.uid),
    name,
    kind,
    currency,
    balance,
  };
  workspace.financialAccounts.push(created);
  return created;
};

const upsertDebt = ({
  id,
  creditor,
  title,
  originalAmount,
  balance,
  currency,
  dueDate,
  notes,
}) => {
  const current = workspace.debts.find((item) => item.id === id);
  if (current) {
    Object.assign(current, {
      creditor,
      title,
      originalAmount,
      balance,
      currency,
      dueDate,
      notes,
      status: balance > 0 ? "pending" : "paid",
      userId: user.uid,
      source: "user",
      updatedAt: Date.now(),
    });
    return current;
  }
  const created = {
    ...entity(id, user.uid),
    creditor,
    title,
    originalAmount,
    balance,
    currency,
    dueDate,
    notes,
    status: balance > 0 ? "pending" : "paid",
  };
  workspace.debts.push(created);
  return created;
};

const cash = upsertAccount({
  id: "account-cash-nio",
  name: "Efectivo",
  kind: "cash",
  currency: "NIO",
  balance: 2500,
});

const card = upsertAccount({
  id: "account-card-usd",
  name: "Tarjeta / banco",
  kind: "card",
  currency: "USD",
  balance: 263,
});

const oliver = upsertDebt({
  id: "debt-oliver",
  creditor: "Oliver",
  title: "Préstamo personal",
  originalAmount: 200,
  balance: 200,
  currency: "USD",
  dueDate: "2026-09-30",
  notes: "Pago previsto para el 30/09/2026.",
});

workspace.user.metadata = {
  ...(workspace.user.metadata || {}),
  financeCutoverDate: CUTOVER_DATE,
  cashNIO: cash.balance,
  cardUSD: card.balance,
  exchangeRateNIOPerUSD: FX,
  exchangeRateSource: "BCN 2026",
};

const backupName =
  "nexus-finance-backup-" +
  user.uid +
  "-" +
  new Date().toISOString().replace(/[:.]/g, "-") +
  ".json";
writeFileSync(
  backupName,
  JSON.stringify(
    {
      uid: user.uid,
      email: user.email || "",
      backedUpAt: new Date().toISOString(),
      document: docData,
    },
    null,
    2,
  ),
);

console.log("\nCuenta seleccionada:", user.email || user.uid);
console.log("Backup local:", backupName);
console.log("\nVista previa financiera:");
console.table([
  {
    item: cash.name,
    balance: cash.balance,
    currency: cash.currency,
    converted: "$" + (cash.balance / FX).toFixed(2),
  },
  {
    item: card.name,
    balance: card.balance,
    currency: card.currency,
    converted: "C$" + (card.balance * FX).toFixed(2),
  },
  {
    item: "Deuda · " + oliver.creditor,
    balance: oliver.balance,
    currency: oliver.currency,
    converted: "C$" + (oliver.balance * FX).toFixed(2),
  },
]);
console.log("Tipo oficial BCN usado:", FX, "NIO por USD");
console.log(
  "\nDRY RUN: no se modificó Firestore.",
);

if (!args.apply) process.exit(0);

await ref.set(
  {
    ...docData,
    workspace,
    updatedAt: Date.now(),
  },
  { merge: false },
);

console.log("\nAPLICADO: cuentas y deuda actualizadas solo para", user.email || user.uid);
console.log("Tarjeta / banco: USD 263.00");
console.log("Efectivo: C$2,500.00");
console.log("Deuda Oliver: USD 200.00 · pendiente");
