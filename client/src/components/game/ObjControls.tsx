import * as React from 'react';
import * as Modal from 'react-modal';
import {Comms} from "./CommsComponent";
import {useEffect, useState} from "react";
import {api} from "../../api";
import {ObjThumbnail} from "./ObjThumbnail";
import {GameObj} from "../../models/GameObj";

export interface ObjControlsProps {
    comms: Comms,
    selectedObj: string,
    setObject(obj: GameObj): void,
}

const customStyles = {
    content: {
        backgroundColor: '#0f111a',
        color: '#e2cca4',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)'
    }
};

Modal.setAppElement('#main');

export function ObjControls(props: ObjControlsProps): React.ReactElement {
    const [uploadObjOpen, setUploadObjOpen] = useState(false);
    const [objName, setObjName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [buttonActive, setButtonActive] = useState(true);
    const [objs, setObjs] = useState([]);

    function deleteObjSync(name: string): void {
        if (confirm(`Delete object "${name}"?`)) {
            api.deleteObj(props.comms.user, name)
                .then(() => props.comms.loadObjsSync(setObjs))
                .catch(console.error);
        }
    }

    function objSelected(name: string) {
        for (const obj of objs) {
            if (obj.name === name) {
                props.setObject(obj);
            }
        }
    }

    // Load objects on startup
    useEffect(() => props.comms.loadObjsSync(setObjs), []);

    function openModal() {
        setUploadObjOpen(true);
    }

    function afterOpenModal() {

    }

    function closeModal() {
        setUploadObjOpen(false);
        setButtonActive(true);
        setObjName('');
        setSelectedFile(null);
        props.comms.loadObjsSync(setObjs);
    }

    function textChangeHandler(event: any) {
        setObjName(event.target.value);
    }

    function fileChangeHandler(event: any) {
        const file = event.target.files[0];
        setSelectedFile(file);

        if (objName.length == 0) {
            setObjName(file.name.replace(/\..*/, ''));
        }
    }

    async function doUpload() {
        const response = await api.createObj(props.comms.user, objName, selectedFile);
        if (response.status) {
            setUploadObjOpen(false);
            closeModal();
        } else {
            alert("File upload failed. Try again later.");
            console.error(response.msg);
        }
    }

    function startUpload() {
        if (selectedFile) {
            setButtonActive(false);
            doUpload().then(r => {
            }).catch(console.error);
        }
    }

    return (
        <div>
            <button onClick={openModal}>New...</button>
            <div className="object-list-container">
                {objs.map(obj => (
                    <ObjThumbnail key={obj.name} selected={obj.name === props.selectedObj} name={obj.name} url={obj.url}
                                  deleteObjSync={() => deleteObjSync(obj.name)}
                                  objSelected={() => objSelected(obj.name)}
                    />))}
            </div>

            <Modal
                isOpen={uploadObjOpen}
                onAfterOpen={afterOpenModal}
                onRequestClose={closeModal}
                style={customStyles}
                contentLabel="upload-obj"
            >
                <div className="modal-container">
                    <h2>Create a new object</h2>
                    <div className="modal-control-container">
                        Name: <input className="modal-control" type="text" value={objName}
                                     onChange={textChangeHandler}/>
                    </div>
                    <div className="modal-control-container">
                        Image: <input className="modal-control" type="file" name="image-file"
                                      onChange={fileChangeHandler}/>
                    </div>
                    <br/>
                    <div className="modal-control-container">
                        <button className="modal-control" disabled={!buttonActive} onClick={startUpload}>
                            {buttonActive ? 'Upload' : 'Uploading...'}
                        </button>
                        <button className="modal-control" onClick={closeModal}>
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}