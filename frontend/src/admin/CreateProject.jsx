import React, { useState } from 'react';
import CreateProjectForm from "../globals/CreateProjectForm";
import ProjectList from "../globals/ProjectList"; 
import '../css/admin.css';

const CreateProject = () => {

    const [activeTab, setActiveTab] = useState('create'); 

    return ( 
        <div className="create-project project-form-container">
         
            <div className="form-tabs">
                <button 
                    className={`tab ${activeTab === 'create' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveTab('create')}
                >
                    Create Project
                </button>
                <button 
                    className={`tab ${activeTab === 'list' ? 'active' : 'inactive'}`}
                    onClick={() => setActiveTab('list')}
                >
                    Project List
                </button>
            </div>
            <div className="tab-divider"></div>


            <div className="tab-content">
                {activeTab === 'create' ? <CreateProjectForm /> : <ProjectList />}
            </div>
        </div>
     );
}
 
export default CreateProject;