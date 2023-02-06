



window.addEventListener("load", () => {
	fetch('./service.json')
		.then( r => r.json() )
		.then( result => {
			console.log( result.text )
		})
})