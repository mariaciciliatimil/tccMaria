import React from 'react';
import { Outlet } from 'react-router-dom';
import SidebarLayout from '../layouts/SidebarLayout.jsx';

export default function Patologista() {
  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  );
}
