import {create} from "zustand";
import * as CurveExtras from "three/examples/jsm/curves/CurveExtras.js";
import * as THREE from "three";

let spline = new THREE.LineCurve3(
  new THREE.Vector3(-50, 0, 0)  ,
    new THREE.Vector3(50, 0, 0)  ,
);

spline = new CurveExtras.KnotCurve()
let track = new THREE.TubeBufferGeometry(spline, 250, 0.2, 10, true)
let guid = 1

function randomData(count, track, radius, size, scale) {
    return new Array(count).fill().map(() => {
        const t = Math.random()
        const pos = track.parameters.path.getPointAt(t)
        pos.multiplyScalar(15)
        const offset = pos
            .clone()
            .add(new THREE.Vector3(-radius + Math.random() * radius * 2, -radius + Math.random() * radius * 2, -radius + Math.random() * radius * 2))
        const speed = 0.1 + Math.random()
        return { guid: guid++, scale: typeof scale === 'function' ? scale() : scale, size, offset, pos, speed, radius, t, hit: new THREE.Vector3(), distance: 1000 }
    })
}


export const options = {
    isBloom: false,
    bloomIntensity: 0.3,
    bloomLuminanceThreshold: 0.6,
    currentPage: 0,
}


export const useStore = create(()=>{return {
    ...options,
    speed: 1,



    t: 0,
    spline,
    track,
    scale: 15,
    fov: 70,
    position: new THREE.Vector3(),
    binormal: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    dummy: new THREE.Object3D(),
    drones: randomData(10, track, 20, 15, 1),
    rocks: randomData(100, track, 150, 8, () => 1 + Math.random() * 2.5),
    rings: randomRings(30, track),
    particles: randomData(1500, track, 100, 1, () => 0.5 + Math.random() * 0.8),
}})


export const addSpeed = (speed) => useStore.setState((state)=>{
    return {
        speed: state.speed + speed
    }
})

export const setBloom = (isBloom)=> useStore.setState(()=>({isBloom}))
export const setPage = (currentPage)=> useStore.setState((state)=>({currentPage}))

export const nextPage = (v)=> useStore.setState((state)=>{
    let oldV = state.currentPage;
    let newV = oldV + v
    if (newV < 0) {
        newV += 5
    }

    newV = newV % 5

    let data = {
        currentPage: newV
    }

    switch (newV) {
        case 0:
            data.isBloom = false
            break;
        case 1:
            data.isBloom = true
            data.bloomIntensity =0.3
            data.bloomLuminanceThreshold= 0.6
            break;
        case 2:
            data.isBloom = true
            data.bloomIntensity =0.6
            data.bloomLuminanceThreshold= 0.6
            break;
        case 3:
            data.isBloom = true
            data.bloomIntensity =1.0
            data.bloomLuminanceThreshold= 0.3
            break;
        case 4:
            data.isBloom = false
            break;
    }

    return data

})

function randomRings(count, track) {
    let temp = []
    let t = 0.4
    for (let i = 0; i < count; i++) {
        t += 0.003
        const pos = track.parameters.path.getPointAt(t)
        pos.multiplyScalar(15)
        const segments = track.tangents.length
        const pickt = t * segments
        const pick = Math.floor(pickt)
        const lookAt = track.parameters.path.getPointAt((t + 1 / track.parameters.path.getLength()) % 1).multiplyScalar(15)
        const matrix = new THREE.Matrix4().lookAt(pos, lookAt, track.binormals[pick])
        temp.push([pos.toArray(), matrix])
    }
    return temp
}