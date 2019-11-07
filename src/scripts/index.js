import '../styles/index.scss';
import { defaultCipherList } from 'constants';

class MainApp {
  constructor() {
    this.getBluetoothButton = document.getElementById("get_bluetooth_device");
    this.bluetoothDeviceList = document.getElementById("bluetooth_devices");
    this.video = document.querySelector('video');
    this.ws = new WebSocket("ws://10.202.83.23:3003");
    this.init();
  }
  init(){
    this.getBluetoothButton.onclick = this.getBluetooth;
    console.log(navigator);
    console.log(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia({video: {width: 1280, height: 720}}).then((stream) => this.video.srcObject = stream);
    this.ws.onopen = () => {
        setInterval(() => {
            this.ws.send(this.getFrame());
        }, 1000 / 30);
    }
  }

  // returns a frame encoded in base64
  getFrame(){
    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    canvas.getContext('2d').drawImage(this.video, 0, 0);
    const data = canvas.toDataURL('image/png');
    return data;
  }
  getBluetooth(){
    fetch("/getbluetooth",{
      method: 'POST', // *GET, POST, PUT, DELETE, etc.

      headers: {
        'Content-Type': 'application/json'
        // 'Content-Type': 'application/x-www-form-urlencoded',
      }
    }).then((res)=> {
      console.log(res);
      return res.json();
    }).then(
      (data=>{
        console.log(data);
        this.bluetoothDeviceList.innerHTML = data[0].tuna;
      })
    )
  }
}
let app = new MainApp();