function init(app) {

    //serving app pages
    require('./app/app').init(app);


    //switch to all route categories
    app.get('/', (req, res) => res.send("It's alive!"));

}

module.exports = {
    init: init
};