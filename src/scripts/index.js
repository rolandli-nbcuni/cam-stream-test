import '../styles/index.scss';

class MainApp {
  constructor() {
    this.getBluetoothButton = document.getElementById("get_bluetooth_device");
    this.bluetoothDeviceList = document.getElementById("bluetooth_devices");
    this.recordButton = document.getElementById("record");
    this.endButton = document.getElementById("stop");
    this.video = document.querySelector('video');
    this.ws = new WebSocket("wss://10.202.83.23:3002");
    this.userId =  window.location.pathname.split('/')[2];
    this.stream;
    this.recordedBlobs;
    this.mediaRecorder;
    this.interval;
    this.videoTracks;
    this.audioTracks;
    this.target;

    this.pc = new RTCPeerConnection({
      iceServers:[{
        urls:"turn:10.202.83.23",
        username: "webrtc",
        credential: "turnserver"
      }]
    });
    this.peerConnections = [];

    this.init.call(this);

  }
  init(){
    // this.pc.onicecandidate = ( candidate) => {
    //   console.log("on");
    //   console.log(candidate);
    //   this.ws.send(JSON.stringify({
    //     action: "new-ice-candidate",
    //     target: candidate.target,
    //     type:"broadcaster",
    //     candidate: candidate.candidate
    //   }))
    // };
    // this.pc.onnegotiationneeded = () => {
    //   alert(2);
    //   this.pc.createOffer().then((offer) =>{
    //     return this.pc.setLocalDescription(offer);
    //   })
    //   .then(()=>{
    //     this.ws.send(JSON.stringify({
    //       action: "send offer",
    //       userId: this.userId,
    //       localDescription: this.pc.localDescription
    //     }));
    //       // Send the offer to the remote peer through the signaling server
    //   })
    //   .catch((error)=>{console.log(error)});
    // }
    this.getBluetoothButton.onclick = this.getBluetooth;
    navigator.mediaDevices.getUserMedia({video: {width: 1280, height: 720},
      audio: true,
    
    }).then((stream) => {
      this.video.srcObject = stream;
      window.stream = stream;
      this.stream = stream;
      // this.videoTracks = stream.getVideoTracks();
      // this.audioTracks = stream.getAudioTracks();
    });
    this.ws.onmessage = (data) =>{
      let wsData = JSON.parse(data.data);
      if(wsData.action == "make pc"){
        let pc = this.createPeerConnection.call(this, wsData.viewerId);
        pc.viewerId = wsData.viewerId;
        this.stream.getTracks().forEach((track) =>
          pc.addTrack(track, stream)
        );
        pc.createOffer(
          {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
          }
        ).then((offer)=>{
          return pc.setLocalDescription(offer)
        })
        .then(()=>{
          this.ws.send(JSON.stringify(
            {
              action: "send description to viewer",
              streamerId: this.userId,
              viewerId: wsData.viewerId ,
              description: pc.localDescription  
            }
          ));
        });
        this.peerConnections.push(pc);
      }
      if(wsData.action == "recieved answer"){
        let desc = new RTCSessionDescription(wsData.description);
        this.peerConnections.forEach((pc)=>{
          if(pc.viewerId === wsData.viewerId){
            pc.setRemoteDescription(desc).then({
            }); 
          }
        });
      }
      if(wsData.action == "new-ice-candidate"){
        this.peerConnections.forEach((pc)=>{
          console.log("New ice");
          if(pc.viewerId === wsData.viewerId){
            console.log(wsData.candidate);
            pc.addIceCandidate(wsData.candidate);
          }
        });

        // var candidate = new RTCIceCandidate(wsData.candidate);


      }
    }
    this.recordButton.onclick = this.record.bind(this);
    this.endButton.onclick = this.stopRecording.bind(this);
  }
  createPeerConnection(viewerId){
    let pc  = new RTCPeerConnection({
      iceServers:[{
        urls:"turn:10.202.83.23",
        username: "webrtc",
        credential: "turnserver"
      }]
    });
    this.pc.onicecandidate = ( candidate) => {
      console.log("on");
      console.log(candidate);
      this.ws.send(JSON.stringify({
        action: "new-ice-candidate",
        target: viewerId,
        type:"broadcaster",
        candidate: candidate.candidate
      }))
    };
    return pc;
  }
  //record video
  record(){
    this.recordedBlobs = [];
    let options = {mimeType: 'video/webm;codecs=vp9'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not Supported`);
      options = {mimeType: 'video/webm;codecs=vp8'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not Supported`);
        options = {mimeType: 'video/webm'};
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.error(`${options.mimeType} is not Supported`);
          options = {mimeType: ''};
        }
      }
    }
    try {
      this.mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
      return;
    }
  
    this.mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
    };
    this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);
    this.mediaRecorder.start(1000); // collect 10ms of data

    if(this.ws.readyState === 1){
      // this.pc.createOffer(
      //   {
      //     offerToReceiveAudio: 1,
      //     offerToReceiveVideo: 1
      //   }
      // ).then((offer)=>{
      //   return this.pc.setLocalDescription(offer)
      // })
      // .then(()=>{
        
        this.ws.send(JSON.stringify(
          {
            action: "start",
            userId: this.userId,
            // type: "video-offer",
            // description: this.pc.localDescription  
          }
        ));
      // });
      // setInterval(() => {
      //     console.log(window.stream);
      //     this.ws.send(JSON.stringify(
      //       {
      //         action: "broadcasting",
      //         userId: this.userId,
      //         videoData: window.stream  
      //       }
      //     ));
      // }, 1000);
    }
  }
  stopRecording(){
    clearInterval(this.clearInterval);
    this.ws.send(JSON.stringify(
      {
        action: "stop",
        userId: this.userId,
      }
    ));
  }
  handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
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