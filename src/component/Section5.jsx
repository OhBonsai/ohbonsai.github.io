import * as THREE from "three"
import React, {useState} from "react";
import {useControls} from "leva";
import {gsap} from "gsap";
import {Hud, Sky, Stars, Text} from "@react-three/drei";
import {useFrame, useLoader, useThree} from "@react-three/fiber";
import {Moon} from "./Section3.jsx"
import CONSTANT from "../constant.js";





export default function Section5() {



    useThree(({camera})=>{
        camera.position.set(0, 0, -15)
        camera.lookAt(new THREE.Vector3(0, 0, 0))
        camera.updateProjectionMatrix()
    })


    // const [[v1, v2, v3], _] = useState(()=>{
    //     return ["video-01.mp4", "video-03-simple-infinite.mp4", "video-03.mp4"].map((url, i)=>{
    //             const vid = document.createElement("video");
    //             vid.src = url
    //             vid.crossOrigin = "Anonymous";
    //             vid.loop = true;
    //             vid.muted = true;
    //             vid.play()
    //             return vid;
    //     })
    // })


    return <>
        <Flower rotation={[0, 0, 0]} position={[0, -13, 40]}/>
        <Hud>
            <Text font={CONSTANT.ROOT_URL + "/cn0.ttf"} rotation={[0, Math.PI , 0]} fontSize={1.4} position={[0, 12, 0]}>且听风吟</Text>
            <Text font={CONSTANT.ROOT_URL + "/cn0.ttf"} rotation={[0, Math.PI , 0]} fontSize={1.4} position={[0, 10.5, 0]}>静待花开</Text>
        </Hud>



        {/*<mesh rotation={[0, 0, 0]} position={[5, 0, 1.1]}>*/}
        {/*    <planeGeometry args={[4.8, 8.2]} />*/}
        {/*    <meshStandardMaterial emissive={"white"} side={THREE.DoubleSide}>*/}
        {/*        <videoTexture attach="map" args={[v1]} />*/}
        {/*        <videoTexture attach="emissiveMap" args={[v1]} />*/}
        {/*    </meshStandardMaterial>*/}
        {/*</mesh>*/}
    </>
}

// const [v1, v2, v3] = ["video-01.mp4", "video-03-simple-infinite.mp4", "video-03.mp4"].map((url, i)=>{
//     const vid = document.createElement("video");
//     vid.src = url
//     vid.crossOrigin = "Anonymous";
//     vid.loop = true;
//     vid.muted = true;
//     vid.play()
//     return vid;
// })

const [v2] =[ "video-03-simple-infinite.mp4"].map((url, i)=>{
    const vid = document.createElement("video");
    vid.src = url
    vid.crossOrigin = "Anonymous";
    vid.loop = true;
    vid.muted = true;
    vid.play()
    return vid;
})


function Flower({...props}) {

    const {gl} = useThree()
    const currentRatio = gl.getPixelRatio()
    console.log(currentRatio, "ratio")

    const material = new THREE.ShaderMaterial({
        // dFdx dFdy
        extensions: {
            derivatives: "#extension GL_OES_standard_derivatives: enable"
        },
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
        wireframe: true,
        uniforms: {
            uTime: {value: 0},
            uTexture: {value: new THREE.VideoTexture(v2)},
            uTexture1: {value: new THREE.VideoTexture(v2)},
            resolution: {value : new THREE.Vector3()}
        },
        vertexShader: `
        
        
float hash21(vec2 p)
{
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
\treturn fract(p.x * p.y);
}

// noise function from https://www.shadertoy.com/view/Msf3WH
vec2 hash( vec2 p ) // replace this by something better
{
\tp = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
\treturn -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float simplex_noise( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

\tvec2  i = floor( p + (p.x+p.y)*K1 );
    vec2  a = p - i + (i.x+i.y)*K2;
    float m = step(a.y,a.x); 
    vec2  o = vec2(m,1.0-m);
    vec2  b = a - o + K2;
\tvec2  c = a - 1.0 + 2.0*K2;
    vec3  h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
\tvec3  n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
    return dot( n, vec3(70.0) );
}

#define NSIZE 1.25
#define NSPEED 0.12
vec3 curl_noise(vec2 p)
{
    const float dt = 1e-4;
    vec2 ds = vec2(dt, 0.0);
    
    p /= NSIZE;
    float n0 = simplex_noise(p);
    float n1 = simplex_noise(p + ds.xy);
    float n2 = simplex_noise(p + ds.yx);
    
    vec2 grad = vec2(n1 - n0, n2 - n0) / ds.x;
    vec2 curl = vec2(grad.y, -grad.x);
    return vec3(curl, n0) * NSIZE * NSPEED;
}

       uniform float uTime;

varying vec2 vUv;

void main() {
    vUv = uv;
    vec3 distortion = curl_noise(vec2(position.x + uTime * .1, position.y));
    vec3 newPosition = position +  distortion * 0.8;
    // newPosition.z = newPosition.z * 5.5;
   
    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectionPosition;
    gl_PointSize = 4.0;
}

        `,
        fragmentShader: `
varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform sampler2D uTexture1;
    uniform float uProgress;

void main() {
      vec3 texture0 = texture2D(uTexture, vUv ).rgb * 1.2;
      vec3 texture1 = texture2D(uTexture1, vUv ).rgb * 1.2;
 
      
      vec3 finalColor = texture0.rgb;
        
      float alpha = 1.0;
      // if (finalColor.r < 0.1) {
      //   alpha = 0.0;
      // }
      
      gl_FragColor = vec4(finalColor, alpha); 
}
`,
    })

    useFrame(({clock})=>{
        material.uniforms.uTime.value = clock.getElapsedTime();

    })


    return <>

        <points material={material} {...props}>
            <planeGeometry args={[48, 82, 48*5, 82*5]}/>
        </points>

    </>
}
