import React, { useState, useEffect } from 'react';

const SelectableTreeView = ({ files, selectedFiles, onFileSelect }) => {
  // Convert flat file array to hierarchical structure
  const buildTreeStructure = (files) => {
    const tree = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // This is a file
          current[part] = { 
            isFile: true, 
            path: file.path,
            size: file.size,
            isBusinessLogic: file.isBusinessLogic
          };
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = { isFile: false, children: {} };
          }
          current = current[part].children;
        }
      }
    });
    
    return tree;
  };

  const [treeStructure, setTreeStructure] = useState({});
  
  useEffect(() => {
    if (files && files.length > 0) {
      setTreeStructure(buildTreeStructure(files));
    }
  }, [files]);

  // Handle checkbox changes
  const handleFileSelect = (path, isChecked) => {
    let updatedSelection;
    
    if (isChecked) {
      updatedSelection = [...selectedFiles, path];
    } else {
      updatedSelection = selectedFiles.filter(p => p !== path);
    }
    
    onFileSelect(updatedSelection);
  };

  // Recursive component to render tree nodes
  const TreeNode = ({ name, node, path }) => {
    const currentPath = path ? `${path}/${name}` : name;
    
    if (node.isFile) {
      return (
        <div className="tree-node file">
          <label className="checkbox-label">
            <input 
              type="checkbox"
              checked={selectedFiles.includes(node.path)}
              onChange={(e) => handleFileSelect(node.path, e.target.checked)}
            />
            <span className={`file-name ${node.isBusinessLogic ? 'business-logic' : ''}`}>
              {name}
            </span>
            <span className="file-size">
              {formatFileSize(node.size)}
            </span>
          </label>
        </div>
      );
    }
    
    // It's a directory
    return (
      <div className="tree-node directory">
        <div className="directory-name">{name}</div>
        <div className="directory-children">
          {Object.entries(node.children).map(([childName, childNode]) => (
            <TreeNode 
              key={childName}
              name={childName}
              node={childNode}
              path={currentPath}
            />
          ))}
        </div>
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="selectable-tree-view">
      {Object.entries(treeStructure).map(([name, node]) => (
        <TreeNode key={name} name={name} node={node} path="" />
      ))}
    </div>
  );
};

export default SelectableTreeView;