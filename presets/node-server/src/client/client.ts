



window.addEventListener("load", () => {
	document.body.append("Check dev tools")
	fetch('./service.json')
		.then( r => r.json() )
		.then( result => console.log( result.text ) )
})


test();
// fdlkfjgdflkj()
