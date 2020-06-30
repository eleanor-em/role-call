import * as React from 'react';
import * as Modal from 'react-modal';
import {Comms} from "./CommsComponent";
import {useEffect, useState} from "react";
import {api} from "../../api";

export interface MapControlsProps {
    comms: Comms,
}

const customStyles = {
    content: {
        backgroundColor       : '#0f111a',
        color                 : '#e2cca4',
        top                   : '50%',
        left                  : '50%',
        right                 : 'auto',
        bottom                : 'auto',
        marginRight           : '-50%',
        transform             : 'translate(-50%, -50%)'
    }
};

Modal.setAppElement('#main');

export function MapControls(props: MapControlsProps): React.ReactElement {
    const [uploadMapOpen, setUploadMapOpen] = useState(false);
    const [mapName, setMapName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [buttonActive, setButtonActive] = useState(true);
    const [maps, setMaps] = useState([]);

    useEffect(() => {
        const loadMaps = async () => {
            const allMaps = await api.getAllMaps(props.comms.user);
            if (allMaps.status) {
                const finalMaps = [];
                for (const map of allMaps.maps) {
                    const mapData = await api.getMap(props.comms.user, map.name);
                    if (mapData.status) {
                        const uri = `data:image/png;base64, ${mapData.data}`;
                        finalMaps.push({
                            name: map.name,
                            uri,
                        });
                        console.log(uri);
                    } else {
                        console.error(`failed to download map ${map.name}`);
                    }
                }
                setMaps(finalMaps);
            } else {
                console.error('failed to get map list');
            }
        };
        loadMaps().then(_ => {});
    }, []);

    function openModal() {
        setUploadMapOpen(true);
    }

    function afterOpenModal() {

    }

    function closeModal() {
        setUploadMapOpen(false);
        setButtonActive(true);
        setMapName('');
        setSelectedFile(null);
    }

    function textChangeHandler(event: any) {
        setMapName(event.target.value);
    }

    function fileChangeHandler(event: any) {
        const file = event.target.files[0];
        setSelectedFile(file);
        console.log('selected');

        if (mapName.length == 0) {
            setMapName(file.name.replace(/\..*/, ''));
        }
    }

    async function doUpload() {
        const response = await api.createMap(props.comms.user, mapName, selectedFile);
        if (response.status) {
            setUploadMapOpen(false);
            closeModal();
        } else {
            alert("File upload failed. Try again later.");
            console.error(response.msg);
        }
    }

    function startUpload() {
        console.log(selectedFile);
        if (selectedFile) {
            console.log('start upload');
            setButtonActive(false);
            doUpload().then(r => {}).catch(console.error);
        }
    }

    return (
        <div>
            <button onClick={openModal}>Upload map...</button>
            <ul>
                {/* TODO: Placeholder code */ maps.map(map => (
                    <li key={map.name}>
                        <img src={map.uri} alt={map.name} />
                    </li>
                ))}
            </ul>

            <Modal
                isOpen={uploadMapOpen}
                onAfterOpen={afterOpenModal}
                onRequestClose={closeModal}
                style={customStyles}
                contentLabel="upload-map"
            >
                <h2>Upload a new map</h2>
                Name: <input type="text" value={mapName} onChange={textChangeHandler} />
                <br/>
                <input type="file" name="image-file" onChange={fileChangeHandler} />
                <br/>
                <button disabled={!buttonActive} onClick={startUpload}>
                    {buttonActive ? 'Upload' : 'Uploading...'}
                </button>
            </Modal>
        </div>
    );
}