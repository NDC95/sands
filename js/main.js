const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');
const projectFiles = document.getElementById('projectFiles');
const fileList = document.getElementById('fileList');

menuBtn.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('is-open');

  menuBtn.classList.toggle('is-open', isOpen);
  menuBtn.setAttribute('aria-expanded', String(isOpen));
  menuBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
});

navLinks.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
    menuBtn.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Open menu');
  });
});

projectFiles.addEventListener('change', () => {
  const files = Array.from(projectFiles.files);
  fileList.innerHTML = '';

  if (files.length > 3) {
  formStatus.style.color = '#a13f2b';
  formStatus.textContent = 'Please upload no more than 3 files.';
  return;
}

  files.forEach((file) => {
    const sizeInMb = (file.size / 1024 / 1024).toFixed(1);
    const item = document.createElement('div');

    item.className = 'file-list-item';
    item.innerHTML = `
      <span>${file.name}</span>
      <span>${sizeInMb} MB</span>
    `;
    fileList.appendChild(item);
  });
});

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = contactForm.querySelector('button[type="submit"]');
  const formData = new FormData(contactForm);

  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const service = String(formData.get('service') || '').trim();
  const message = String(formData.get('message') || '').trim();

  const files = Array.from(projectFiles.files);
  const maxFileSizeMb = 8;

  const oversizedFile = files.find(
    (file) => file.size > maxFileSizeMb * 1024 * 1024
  );

  // Validate required fields
  if (!name || !phone || !service || !message) {
    formStatus.style.color = '#a13f2b';
    formStatus.textContent =
      'Please complete the required fields before sending.';
    return;
  }

  // Validate upload size
  if (oversizedFile) {
    formStatus.style.color = '#a13f2b';
    formStatus.textContent =
      `${oversizedFile.name} is too large. ` +
      `Please keep each file under ${maxFileSizeMb} MB.`;
    return;
  }

  formStatus.style.color = '#247c51';
  formStatus.textContent = files.length
    ? `Sending your request with ${files.length} file${
        files.length === 1 ? '' : 's'
      } attached...`
    : 'Sending your request...';

  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';

  try {
    const response = await fetch(contactForm.action, {
      method: 'POST',
      body: formData
    });

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      result = {
        success: false,
        message: responseText || 'Unexpected response from the server.'
      };
    }

    if (!response.ok) {
      throw new Error(
        result.message || `Request failed with status ${response.status}.`
      );
    }

    if (!result.success) {
      throw new Error(result.message || 'The request could not be sent.');
    }

    formStatus.style.color = '#247c51';
    formStatus.textContent =
      '✅ Thank you! Your request has been sent successfully.';

    contactForm.reset();
    fileList.innerHTML = '';
  } catch (error) {
    console.error('Contact form error:', error);

    formStatus.style.color = '#a13f2b';
    formStatus.textContent =
      `❌ ${error.message || 'Something went wrong. Please try again.'}`;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send Request';
  }
});