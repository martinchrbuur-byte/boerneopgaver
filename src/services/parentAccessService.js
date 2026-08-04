const PARENT_PIN = '2107';

export function createParentAccessService() {
  let unlocked = false;

  function verifyPin(value) {
    if (value === PARENT_PIN) {
      unlocked = true;
      return true;
    }

    return false;
  }

  function lock() {
    unlocked = false;
  }

  function isUnlocked() {
    return unlocked;
  }

  return {
    verifyPin,
    lock,
    isUnlocked
  };
}
