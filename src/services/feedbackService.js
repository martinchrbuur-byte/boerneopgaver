import { nowIsoTimestamp } from '../shared/dateTime.js';
import { createEntityId } from '../shared/id.js';

export const FEEDBACK_CATEGORIES = Object.freeze([
  'general',
  'bug',
  'idea',
  'quality',
  'question'
]);

export const FEEDBACK_MESSAGES = Object.freeze({
  parentOnlyCreate: 'Kun forældrevisning kan sende feedback.',
  invalidMessage: 'Skriv venligst lidt feedback, før du sender.',
  invalidCategory: 'Vælg en gyldig feedback-kategori.',
  created: 'Feedback gemt og klar til senere implementering.'
});

function isParentRole(role) {
  return role === 'parent';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCategory(category) {
  const normalized = normalizeText(category).toLowerCase();
  return normalized || 'general';
}

function asResult(ok, message, entries) {
  return { ok, message, entries };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createFeedbackService({ storageService, nowProvider = nowIsoTimestamp } = {}) {
  if (!storageService) {
    throw new Error('createFeedbackService requires storageService.');
  }

  function listEntries() {
    return sortEntries(storageService.loadData().feedback ?? []);
  }

  function createFeedbackEntry({ actorRole, title = '', message = '', category = 'general' } = {}) {
    if (!isParentRole(actorRole)) {
      return asResult(false, FEEDBACK_MESSAGES.parentOnlyCreate, listEntries());
    }

    const nextMessage = normalizeText(message);
    if (!nextMessage) {
      return asResult(false, FEEDBACK_MESSAGES.invalidMessage, listEntries());
    }

    const nextCategory = normalizeCategory(category);
    if (!FEEDBACK_CATEGORIES.includes(nextCategory)) {
      return asResult(false, FEEDBACK_MESSAGES.invalidCategory, listEntries());
    }

    const nextTitle = normalizeText(title);

    storageService.updateData((data) => ({
      ...data,
      feedback: [
        ...(data.feedback ?? []),
        {
          id: createEntityId('feedback'),
          title: nextTitle,
          message: nextMessage,
          category: nextCategory,
          createdAt: nowProvider(),
          createdBy: 'parent',
          status: 'open'
        }
      ]
    }));

    return asResult(true, FEEDBACK_MESSAGES.created, listEntries());
  }

  return {
    listEntries,
    createFeedbackEntry
  };
}