// information_uuid_v5=8a316e1b-bae7-5afc-8944-cb8453fc1aae
// event_uuid_v7=01a04bd0-b895-7563-9e53-f938f586ff2a state_transition=EMPTY -> PREPARED -> HUMAN_APPROVED -> COMMITTED -> RETRY_RECOGNIZED occurred_at=2026-08-29T01:00:00Z
// machine-contract: every input change immediately invalidates the visible approval binding; only the visible human button can recheck and commit the exact current intent, fingerprint, and price digest. WebMCP gets four safer functions through its separate adapter.
import "./styles.css";
import {
  calculateBookingQuote,
  calculateCancellationPreview,
  defaultBookingInput,
  deriveBookingFingerprint,
} from "../../src/typescript/hotel/booking-domain.js";
import {
  expireHotelBookingPreparation,
  getHotelBookingStatus,
  humanApproveAndCommit,
  prepareHotelBooking,
  recognizeHotelBookingRetry,
} from "../../src/typescript/hotel/browser-store.js";
import { registerHotelBookingTools } from "../../src/typescript/hotel/webmcp-adapter.js";

const HOTEL_ID = "fictional-kyoto-ryokan";
const ROOM_PLAN_ID = "standard-flexible";
const ACTIVE_INTENT_STORAGE_KEY = "fictional-kyoto-hotel:last-active-intent:v1";

const elements = Object.freeze({
  form: document.querySelector("#booking-form"),
  checkIn: document.querySelector("#check-in"),
  checkOut: document.querySelector("#check-out"),
  adults: document.querySelector("#adults"),
  rooms: document.querySelector("#rooms"),
  preferredLanguage: document.querySelector("#preferred-language"),
  prepare: document.querySelector("#prepare"),
  approve: document.querySelector("#approve"),
  retry: document.querySelector("#retry"),
  formError: document.querySelector("#form-error"),
  priceTotal: document.querySelector("#price-total"),
  cancellationCopy: document.querySelector("#cancellation-copy"),
  stateName: document.querySelector("#state-name"),
  stateExplanation: document.querySelector("#state-explanation"),
  attemptCount: document.querySelector("#attempt-count"),
  bookingCount: document.querySelector("#booking-count"),
  effectCount: document.querySelector("#effect-count"),
  connectionState: document.querySelector("#connection-state"),
  lostResponse: document.querySelector("#lost-response"),
  resultSummary: document.querySelector("#result-summary"),
  confirmationNumber: document.querySelector("#confirmation-number"),
  toolStatus: document.querySelector("#tool-status"),
  serviceGrid: document.querySelector("#service-grid"),
});

let activeBinding = null;
let inputGeneration = 0;
let expiryTimer = null;

function currentInput() {
  return {
    hotelId: HOTEL_ID,
    roomPlanId: ROOM_PLAN_ID,
    checkInDate: elements.checkIn.value,
    checkOutDate: elements.checkOut.value,
    adults: Number(elements.adults.value),
    rooms: Number(elements.rooms.value),
    preferredLanguage: elements.preferredLanguage.value,
  };
}

function populateInput(input) {
  elements.checkIn.value = input.checkInDate;
  elements.checkOut.value = input.checkOutDate;
  elements.adults.value = String(input.adults);
  elements.rooms.value = String(input.rooms);
  elements.preferredLanguage.value = input.preferredLanguage ?? "en";
}

function rememberActiveIntent(status) {
  if (!status?.exists || typeof status.intentId !== "string") return;
  try {
    localStorage.setItem(ACTIVE_INTENT_STORAGE_KEY, status.intentId);
  } catch {
    // Storage can be disabled. IndexedDB remains the booking source of truth.
  }
}

function readRememberedIntent() {
  try {
    return localStorage.getItem(ACTIVE_INTENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function formatYen(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInstant(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function showError(error) {
  elements.formError.textContent = error instanceof Error ? error.message : String(error);
  elements.formError.hidden = false;
}

function clearError() {
  elements.formError.textContent = "";
  elements.formError.hidden = true;
}

function setBusy(isBusy) {
  elements.prepare.disabled = isBusy;
  for (const input of [elements.checkIn, elements.checkOut, elements.adults, elements.rooms, elements.preferredLanguage]) {
    input.disabled = isBusy;
  }
  if (isBusy) {
    elements.approve.disabled = true;
    elements.retry.disabled = true;
  }
}

function invalidateVisibleApproval() {
  inputGeneration += 1;
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  activeBinding = null;
  elements.approve.disabled = true;
  elements.retry.disabled = true;
  elements.lostResponse.hidden = true;
  elements.stateExplanation.textContent = "Booking details changed. Rechecking this exact request.";
}

function updatePreview() {
  clearError();
  try {
    const input = currentInput();
    const quote = calculateBookingQuote(input);
    const preview = calculateCancellationPreview(input);
    elements.priceTotal.textContent = `${formatYen(quote.totalPriceJpy)} · ${quote.nights} night${quote.nights === 1 ? "" : "s"}`;
    elements.cancellationCopy.textContent = `Free until ${formatInstant(preview.freeCancellationDeadline)}. Later: ${formatYen(preview.lateCancellationFeeJpy)} (one night per room). Preview only.`;
  } catch (error) {
    elements.priceTotal.textContent = "Check the dates and room capacity";
    elements.cancellationCopy.textContent = "Enter a stay of 1–14 nights with no more than two adults per room.";
    showError(error);
  }
}

const explanations = Object.freeze({
  EMPTY: "No simulated booking has been prepared on this device.",
  PREPARED: "Details are valid. A visible human confirmation is required within 120 seconds.",
  COMMITTED: "One simulated booking is stored, but its success response was intentionally hidden.",
  RETRY_RECOGNIZED: "The retry found the existing result. It did not start another booking.",
  EXPIRED: "The 120-second preparation expired without confirmation. Change the details to prepare a new intent.",
});

function renderStatus(status) {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  const state = status?.state ?? "EMPTY";
  activeBinding = status?.intentId
    ? Object.freeze({
      intentId: status.intentId,
      fingerprint: status.fingerprint,
      approvalPayloadDigest: status.approvalPayloadDigest,
      state,
    })
    : null;
  elements.stateName.textContent = state;
  elements.stateExplanation.textContent = explanations[state] ?? "The local state was recovered.";
  elements.attemptCount.textContent = String(status?.attemptCount ?? 0);
  elements.bookingCount.textContent = status?.bookingExists ? "1" : "0";
  elements.effectCount.textContent = String(status?.effectStartCount ?? 0);

  const canApprove = state === "PREPARED" && !status.approvalExpired;
  elements.approve.disabled = !canApprove;
  elements.retry.disabled = state !== "COMMITTED";
  elements.lostResponse.hidden = state !== "COMMITTED";
  elements.confirmationNumber.textContent = "";
  rememberActiveIntent(status);

  if (state === "PREPARED") {
    elements.resultSummary.textContent = `Prepared for ${formatYen(status.quote.totalPriceJpy)}. Confirm within 120 seconds.`;
  } else if (state === "COMMITTED") {
    elements.resultSummary.textContent = "The response disappeared before the confirmation number was shown. Retry safely to recover it.";
  } else if (state === "RETRY_RECOGNIZED") {
    elements.resultSummary.textContent = "2 attempts → 1 simulated booking → 1 confirmation number";
    elements.confirmationNumber.textContent = status.confirmationNumber;
  } else if (state === "EXPIRED") {
    elements.resultSummary.textContent = "Preparation expired. No booking was created.";
  } else {
    elements.resultSummary.textContent = "Prepare a booking to begin.";
  }

  if (state === "PREPARED" && !status.approvalExpired && status.approvalExpiresAt) {
    const generation = inputGeneration;
    const intentId = status.intentId;
    const delay = Math.max(0, Date.parse(status.approvalExpiresAt) - Date.now());
    expiryTimer = setTimeout(async () => {
      try {
        const expired = await expireHotelBookingPreparation(intentId);
        if (generation === inputGeneration && activeBinding?.intentId === intentId) renderStatus(expired);
      } catch (error) {
        if (generation === inputGeneration) showError(error);
      }
    }, delay);
  }
}

async function restoreCurrentStatus() {
  const generation = inputGeneration;
  const input = currentInput();
  try {
    let status = await getHotelBookingStatus(input);
    if (status.approvalExpired && status.intentId) {
      status = await expireHotelBookingPreparation(status.intentId);
    }
    if (generation !== inputGeneration) return;
    renderStatus(status);
  } catch (error) {
    if (generation !== inputGeneration) return;
    activeBinding = null;
    elements.approve.disabled = true;
    elements.retry.disabled = true;
    showError(error);
  }
}

async function restoreRememberedStatus() {
  const intentId = readRememberedIntent();
  if (!intentId) return false;
  try {
    let status = await getHotelBookingStatus(intentId);
    if (!status.exists || !status.normalizedInput) return false;
    if (status.approvalExpired) status = await expireHotelBookingPreparation(intentId);
    populateInput(status.normalizedInput);
    updatePreview();
    renderStatus(status);
    return true;
  } catch {
    return false;
  }
}

async function reflectSafeToolResult({ result }) {
  const generation = inputGeneration;
  try {
    const visibleFingerprint = await deriveBookingFingerprint(currentInput());
    if (generation !== inputGeneration || result?.fingerprint !== visibleFingerprint) return;
    renderStatus(result);
  } catch {
    // A tool result for different or currently invalid form data stays tool-only.
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  invalidateVisibleApproval();
  const generation = inputGeneration;
  const input = currentInput();
  setBusy(true);
  try {
    const status = await prepareHotelBooking(input);
    if (generation !== inputGeneration) return;
    renderStatus(status);
  } catch (error) {
    if (generation === inputGeneration) showError(error);
  } finally {
    if (generation === inputGeneration) setBusy(false);
  }
});

elements.approve.addEventListener("click", async () => {
  clearError();
  const generation = inputGeneration;
  const binding = activeBinding;
  const input = currentInput();
  setBusy(true);
  try {
    if (!binding || binding.state !== "PREPARED") throw new Error("Prepare the booking before confirming it.");
    const visible = await getHotelBookingStatus(input);
    if (
      generation !== inputGeneration
      || visible.state !== "PREPARED"
      || visible.intentId !== binding.intentId
      || visible.fingerprint !== binding.fingerprint
      || visible.approvalPayloadDigest !== binding.approvalPayloadDigest
    ) {
      throw new Error("Booking details changed. Prepare this exact request again before confirming it.");
    }
    const status = await humanApproveAndCommit(input, {
      expectedIntentId: binding.intentId,
      expectedFingerprint: binding.fingerprint,
      expectedApprovalPayloadDigest: binding.approvalPayloadDigest,
    });
    if (generation !== inputGeneration) return;
    renderStatus(status);
  } catch (error) {
    if (generation === inputGeneration) showError(error);
  } finally {
    if (generation === inputGeneration) setBusy(false);
  }
});

elements.retry.addEventListener("click", async () => {
  clearError();
  const generation = inputGeneration;
  const binding = activeBinding;
  const input = currentInput();
  setBusy(true);
  try {
    if (!binding || binding.state !== "COMMITTED") throw new Error("No simulated booking is available to retry.");
    const visible = await getHotelBookingStatus(input);
    if (generation !== inputGeneration || visible.intentId !== binding.intentId || visible.state !== "COMMITTED") {
      throw new Error("Booking details changed. Restore the committed request before retrying it.");
    }
    const status = await recognizeHotelBookingRetry(input);
    if (generation !== inputGeneration) return;
    renderStatus(status);
  } catch (error) {
    if (generation === inputGeneration) showError(error);
  } finally {
    if (generation === inputGeneration) setBusy(false);
  }
});

for (const input of [elements.checkIn, elements.checkOut, elements.adults, elements.rooms, elements.preferredLanguage]) {
  input.addEventListener("change", () => {
    invalidateVisibleApproval();
    updatePreview();
    restoreCurrentStatus();
  });
}

function updateConnectionState() {
  const isOnline = navigator.onLine;
  elements.connectionState.textContent = isOnline ? "Online" : "Offline · local state available";
  elements.connectionState.classList.toggle("offline", !isOnline);
}

async function renderServices() {
  try {
    const response = await fetch("/service-integrations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const serviceRegistry = await response.json();
    elements.serviceGrid.replaceChildren(...serviceRegistry.services.map((service) => {
      const card = document.createElement("article");
      card.className = "service-card";
      const title = document.createElement("h3");
      title.textContent = service.displayName;
      const list = document.createElement("dl");
      const approvalState = service.approvalGates?.some((gate) => gate.state === "REQUIRES_SEPARATE_APPROVAL")
        ? "SEPARATE APPROVAL"
        : service.approvalGates?.some((gate) => gate.state.startsWith("AUTHORIZED"))
          ? "PLAN AUTHORIZED"
          : "OUT OF SCOPE";
      for (const [label, value] of [
        ["Plugin", service.pluginState],
        ["Sign-in", service.authenticationState],
        ["Publish", service.publicationState],
        ["Run", service.runtimeState],
        ["Approval", approvalState],
      ]) {
        const row = document.createElement("div");
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value.replaceAll("_", " ");
        row.append(term, description);
        list.append(row);
      }
      card.append(title, list);
      return card;
    }));
  } catch (error) {
    elements.serviceGrid.textContent = `Service record unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function initialize() {
  const defaults = defaultBookingInput();
  populateInput(defaults);
  updatePreview();
  updateConnectionState();
  if (!await restoreRememberedStatus()) await restoreCurrentStatus();

  const registration = await registerHotelBookingTools({
    getCurrentInput: currentInput,
    onResult: reflectSafeToolResult,
  });
  elements.toolStatus.textContent = registration.supported
    ? `${registration.registeredToolNames.length} tools registered in this browser`
    : "WebMCP runtime not exposed here · page demo still works";

  await renderServices();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
  }
}

window.addEventListener("online", updateConnectionState);
window.addEventListener("offline", updateConnectionState);
initialize().catch(showError);
