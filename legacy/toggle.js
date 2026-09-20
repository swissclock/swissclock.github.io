    let toggle1 = false;
    let toggle2 = false;
    let toggle3 = false;
    let toggle4 = false;
    document.addEventListener('click', function(event) {
        if (event.target.matches('h1')) {
        if (event.target.matches('#bio-link')) {
        toggle1 = true;
        toggle2 = false;
        toggle3 = false;
        } else if (event.target.matches('#science-link')) {
        toggle1 = false;
        toggle2 = false;
        toggle3 = false;
        toggle4 = true;
        } else if(event.target.matches('#fun-link')) {
        toggle1 = false;    
        toggle2 = true;
        toggle3 = false;
        toggle4 = false;
        } else if (event.target.matches('#publications-link')) {
        toggle1 = false;
        toggle2 = false;
        toggle3 = true;
        }
    document.querySelector('#bio').classList.toggle('hidden', !toggle1);
    document.querySelector('#projects').classList.toggle('hidden', !toggle2);
    document.querySelector('#publications').classList.toggle('hidden', !toggle3);
    }
    });  

//     document.querySelector('#bio').addEventListener('animationend', function() {
//     document.querySelector('#bio-content').style.display = 'block';
//     document.querySelector('#bio-content').classList.add('fadein');
// });