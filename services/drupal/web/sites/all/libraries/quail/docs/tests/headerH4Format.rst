===============================
All h4 elements are not used for formatting
===============================

*Severity code:* Information only

.. php:class:: headerH4Format


An <code>h4 element may not be used purely for formatting.




Users of screen readers often use headers to discover the structure of the document, and using headers for formatting can cause this method of navigating the document to be confusing. Try using CSS styles to apply formatting to the item instead.



Example
-------
Wrong
-----

.. code-block:: html

    <h4>I wanted a line to be bold and large but this is just a regular paragraph.</h4>



Right
-----

.. code-block:: html

    <p class="large-item"><strong>I wanted a line to be bold and large but this is just a regular paragraph.</strong></p>




