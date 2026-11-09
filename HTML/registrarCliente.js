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

	const mensaje1 = document.getElementById('resultado1');
	const mensaje2 = document.getElementById('resultado2');
	mensaje1.textContent = '';
	mensaje2.textContent = '';
	mensaje1.style.textAlign = 'center';
	mensaje2.style.textAlign = 'center';

	if (data.contacto == '' || data.password == '') {
		mensaje1.style.color = 'RED';
		mensaje1.textContent = 'Debe informar correo electrónico y password para completar el registro';
		return;
	}
	if (data.password !== data.confirmarPassword) {
    mensaje1.style.color = 'RED';
    mensaje1.textContent = 'Las contraseñas no coinciden';
    return;
}
	if (data.termscondition != 'on') {
		mensaje2.style.color = 'RED';
		mensaje2.textContent = 'Debe aceptar los T&C para poder registrarse';
		return;
	}

	const registro = {
		contacto: data.contacto,
		nombre: data.contacto.split('@')[0],
		password: data.password,
	};

	const options = {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(registro),
	};

	fetch('http://localhost:8080/api/addCliente', options)
        .then((res) => res.json())
        .then((respuesta) => {
            if (respuesta.response == 'OK') {
                mensaje2.style.color = 'GREEN';
                mensaje2.textContent = 'Registro exitoso, volviendo al login...';
            } else {
                mensaje2.style.color = 'RED';
                mensaje2.textContent = 'No se pudo registrar: ' + respuesta.message;
            } 
        })
        .catch(() => {
            mensaje2.style.color = 'RED';
            mensaje2.textContent = 'No se pudo comunicar con el servidor';
        });
});
