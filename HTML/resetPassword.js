const formE1 = document.querySelector('.form');

/*---
    Si se llega desde el login con el correo ya tipeado, se precarga en el formulario
    */
const parametros = new URLSearchParams(document.location.search);
if (parametros.get('contacto')) {
	document.querySelector('input[name="contacto"]').value = parametros.get('contacto');
}

formE1.addEventListener('submit', (event) => {
	event.preventDefault();
	const formData = new FormData(formE1);
	const data = Object.fromEntries(formData);

	const mensaje = document.getElementById('resultado1');
	mensaje.textContent = '';
	mensaje.style.textAlign = 'center';

	/*---
	    Validaciones en el navegador antes de llamar al servidor
	    */
	if (data.contacto == '' || data.password == '' || data.password2 == '') {
		mensaje.style.color = 'RED';
		mensaje.textContent = 'Debe completar el correo y las dos contraseñas';
		return;
	}
	if (data.password != data.password2) {
		mensaje.style.color = 'RED';
		mensaje.textContent = 'Las contraseñas no coinciden';
		return;
	}

	/*---
	    Si coinciden, se actualiza la password en la base de datos mediante el REST API
	    */
	const cambio = {
		contacto: data.contacto,
		password: data.password,
	};

	const options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(cambio),
	};

	fetch('http://localhost:8080/api/resetCliente', options)
		.then((res) => res.json())
		.then((respuesta) => {
			if (respuesta.response == 'OK') {
				mensaje.style.color = 'GREEN';
				mensaje.textContent = 'Contraseña actualizada, volviendo al login...';
			} else {
				mensaje.style.color = 'RED';
				mensaje.textContent = 'No se pudo cambiar la contraseña: ' + respuesta.message;
			}
		})
		.catch(() => {
			mensaje.style.color = 'RED';
			mensaje.textContent = 'No se pudo comunicar con el servidor';
		});
});