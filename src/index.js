window.Webflow ||= [];
window.Webflow.push(() => {
  document.querySelectorAll('form').forEach((form) => {
    if (form.querySelector('[data-form-slide="initial"]')) {
      initMultistepForm(form);
    } else {
      initSingleStepForm(form);
    }
  });
});

function initMultistepForm(form) {
  form.setAttribute('novalidate', '');

  const stepText = form.querySelector('[data-form-step-text]');
  const progressBar = form.querySelector('[data-form-progress]');
  const previousBtn = form.querySelector('[data-action="previous"]');
  const successSlide = form.querySelector('[data-form-slide="success"]');

  const flow = Array.from(form.querySelectorAll('.form_slide')).filter(
    (slide) => slide.dataset.formSlide !== 'success'
  );
  if (flow.length === 0) return;

  const totalSteps = flow.length;
  let currentIndex = 0;

  flow.forEach((slide, i) => slide.classList.toggle('hide', i !== 0));
  successSlide?.classList.add('hide');
  updateProgress();

  const initialSlide = flow[0];
  const companySlide = form.querySelector('[name="company"]')?.closest('.form_slide') ?? null;
  const businessFieldNames = ['company', 'country', 'numemployees'];
  const requiredBusinessFieldNames = new Set(['company', 'country']);
  const messageField = form.querySelector('[name="message"]');

  applyContactTypeVisibility(getSelectedContactType());

  initialSlide.addEventListener('click', (e) => {
    const { target } = e;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'radio' || target.name !== 'contact_type') return;
    if (!target.checked) return;
    applyContactTypeVisibility(target.value);
    goTo(currentIndex + 1);
  });

  form.querySelectorAll('[data-action="next"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const slide = btn.closest('.form_slide');
      if (!validateFields(slide)) return;
      goTo(currentIndex + 1);
    });
  });

  previousBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    goTo(currentIndex - 1);
  });

  form.addEventListener('input', clearErrorFromEvent);
  form.addEventListener('change', clearErrorFromEvent);

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const currentSlide = flow[currentIndex];
      if (!validateFields(currentSlide)) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      try {
        const formData = new FormData(form);
        populateHubSpotTrackingFields(formData);
        const response = await fetch(form.action, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          console.error('Form submission failed:', response.status);
          return;
        }
        showSuccess();
      } catch (err) {
        console.error('Form submission error:', err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          if (originalLabel) submitBtn.textContent = originalLabel;
        }
      }
    },
    { capture: true }
  );

  function goTo(index) {
    if (index < 0 || index >= flow.length) return;
    flow[currentIndex].classList.add('hide');
    flow[index].classList.remove('hide');
    currentIndex = index;
    updateProgress();
  }

  function showSuccess() {
    if (!successSlide) return;
    flow[currentIndex].classList.add('hide');
    successSlide.classList.remove('hide');
    stepText?.classList.add('hide');
    previousBtn?.classList.add('hide');
    if (progressBar) progressBar.style.width = '100%';
  }

  function updateProgress() {
    const step = currentIndex + 1;
    if (step === 1) {
      stepText?.classList.remove('hide');
      previousBtn?.classList.add('hide');
      if (stepText) stepText.textContent = `Step ${String(step).padStart(2, '0')}`;
    } else {
      stepText?.classList.add('hide');
      previousBtn?.classList.remove('hide');
      if (previousBtn) previousBtn.textContent = `← Step ${String(step).padStart(2, '0')}`;
    }
    if (progressBar) {
      progressBar.style.width = step > 1 ? `${(step / totalSteps) * 100}%` : '';
    }
  }

  function getSelectedContactType() {
    return form.querySelector('input[type="radio"][name="contact_type"]:checked')?.value ?? null;
  }

  function applyContactTypeVisibility(contactType) {
    if (!companySlide) return;
    const showBusinessFields = contactType === 'Customer' || contactType === 'Distributor';

    companySlide.querySelectorAll('[data-form-title]').forEach((el) => {
      const category = el.dataset.formTitle;
      const shouldShow =
        (category === 'business' && showBusinessFields) ||
        (category === 'personal' && !showBusinessFields);
      el.classList.toggle('hide', !shouldShow);
    });

    businessFieldNames.forEach((name) => {
      const field = companySlide.querySelector(`[name="${name}"]`);
      if (!field) return;
      const wrapper = field.closest('.form_field-wrapper') ?? field;
      wrapper.classList.toggle('hide', !showBusinessFields);
      if (showBusinessFields && requiredBusinessFieldNames.has(name)) {
        field.setAttribute('required', '');
      } else {
        field.removeAttribute('required');
        clearFieldError(field);
        if (!showBusinessFields) field.value = '';
      }
    });

    if (messageField) {
      if (showBusinessFields) {
        messageField.removeAttribute('required');
      } else {
        messageField.setAttribute('required', '');
      }
    }
  }
}

function initSingleStepForm(form) {
  const { scope, successSlide } = findSuccessScope(form);
  if (!scope || !successSlide) return;

  form.setAttribute('novalidate', '');
  successSlide.classList.add('hide');

  form.addEventListener('input', clearErrorFromEvent);
  form.addEventListener('change', clearErrorFromEvent);

  form.addEventListener(
    'submit',
    (e) => {
      if (!validateFields(form)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      waitForResponseThenReveal(form, scope, successSlide);
    },
    { capture: true }
  );
}

function findSuccessScope(form) {
  let scope = form;
  while (scope) {
    const successSlide = scope.querySelector('[data-form-slide="success"]');
    if (successSlide) return { scope, successSlide };
    scope = scope.parentElement;
  }
  return { scope: null, successSlide: null };
}

function waitForResponseThenReveal(form, scope, successSlide, timeoutMs = 30000) {
  let revealed = false;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node === successSlide || successSlide.contains(node)) continue;
        if (!revealed) {
          revealed = true;
          revealSuccessSlide(scope, successSlide);
        }
        node.classList.add('hide');
      }
    }
  });
  observer.observe(form, { childList: true });
  setTimeout(() => observer.disconnect(), timeoutMs);
}

function revealSuccessSlide(scope, successSlide) {
  scope.querySelectorAll('[data-form-hide-on-success]').forEach((el) => {
    if (el === successSlide || el.contains(successSlide)) return;
    el.classList.add('hide');
  });
  successSlide.classList.remove('hide');
}

function validateFields(root) {
  if (!root) return true;

  let firstInvalid = null;
  root.querySelectorAll('input, select, textarea').forEach((field) => {
    if (field.type === 'radio' || field.type === 'checkbox' || field.type === 'hidden') return;
    if (isFieldHidden(field)) {
      clearFieldError(field);
      return;
    }
    const message = getFieldError(field);
    if (message) {
      showFieldError(field, message);
      if (!firstInvalid) firstInvalid = field;
    } else {
      clearFieldError(field);
    }
  });

  const seenRadioGroups = new Set();
  root.querySelectorAll('input[type="radio"][required]').forEach((radio) => {
    if (!radio.name || seenRadioGroups.has(radio.name)) return;
    seenRadioGroups.add(radio.name);
    const checked = root.querySelector(
      `input[type="radio"][name="${CSS.escape(radio.name)}"]:checked`
    );
    if (!checked && !firstInvalid) firstInvalid = radio;
  });

  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: false });
    return false;
  }
  return true;
}

function getFieldError(field) {
  const value = (field.value ?? '').trim();
  if (field.hasAttribute('required') && !value) {
    return 'This field is required.';
  }
  if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

function isFieldHidden(field) {
  let el = field;
  while (el && el !== document.body) {
    if (el.classList?.contains('hide')) return true;
    el = el.parentElement;
  }
  return false;
}

function showFieldError(field, message) {
  const wrapper = field.closest('.form_field-wrapper') ?? field.parentElement;
  if (!wrapper) return;
  wrapper.classList.add('is-error');
  let errorEl = wrapper.querySelector('[data-form-error]');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.setAttribute('data-form-error', '');
    errorEl.style.cssText = 'color:#e94d35;font-size:0.75rem;margin-top:0.375rem;line-height:1.3;';
    wrapper.appendChild(errorEl);
  }
  errorEl.textContent = message;
}

function clearFieldError(field) {
  const wrapper = field.closest?.('.form_field-wrapper') ?? field.parentElement;
  if (!wrapper) return;
  wrapper.classList.remove('is-error');
  const errorEl = wrapper.querySelector('[data-form-error]');
  if (errorEl) errorEl.textContent = '';
}

function populateHubSpotTrackingFields(formData) {
  for (const [name] of formData.entries()) {
    switch (name) {
      case 'hutk': {
        const hutk = document.cookie
          .split('; ')
          .find((c) => c.startsWith('hubspotutk='))
          ?.split('=')[1];
        if (hutk) formData.set(name, hutk);
        break;
      }
      case 'pageUri':
        formData.set(name, window.location.href);
        break;
      case 'pageName':
        formData.set(name, document.title);
        break;
      case 'pageId':
        formData.set(name, window.location.pathname);
        break;
      default:
        break;
    }
  }
}

function clearErrorFromEvent(e) {
  const t = e.target;
  if (
    t instanceof HTMLInputElement ||
    t instanceof HTMLSelectElement ||
    t instanceof HTMLTextAreaElement
  ) {
    clearFieldError(t);
  }
}
