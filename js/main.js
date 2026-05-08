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

  if (!files.length) {
    return;
  }

  files.forEach((file) => {
    const sizeInMb = (file.size / 1024 / 1024).toFixed(1);
    const item = document.createElement('div');
    item.className = 'file-list-item';
    item.innerHTML = `<span>${file.name}</span><span>${sizeInMb} MB</span>`;
    fileList.appendChild(item);
  });
});

contactForm.addEventListener('submit', (event) => {
  const formData = new FormData(contactForm);
  const name = formData.get('name').trim();
  const phone = formData.get('phone').trim();
  const service = formData.get('service');
  const message = formData.get('message').trim();
  const files = Array.from(projectFiles.files);
  const maxFileSizeMb = 25;
  const oversizedFile = files.find((file) => file.size > maxFileSizeMb * 1024 * 1024);

  if (!name || !phone || !service || !message) {
    event.preventDefault();
    formStatus.style.color = '#a13f2b';
    formStatus.textContent = 'Please complete the required fields before sending.';
    return;
  }

  if (oversizedFile) {
    event.preventDefault();
    formStatus.style.color = '#a13f2b';
    formStatus.textContent = `${oversizedFile.name} is too large. Please keep each file under ${maxFileSizeMb} MB.`;
    return;
  }

  formStatus.style.color = '#247c51';
  formStatus.textContent = files.length
    ? `Sending your request with ${files.length} file${files.length === 1 ? '' : 's'} attached...`
    : 'Sending your request...';
});
