module.exports = {
	helpers: require('./helpers'),
	get webbluetooth() {
		var bluetooth = require('./webbluetooth');
		require('./adapter.noble')(bluetooth);
		return bluetooth;
	}
};